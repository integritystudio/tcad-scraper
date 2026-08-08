/**
 * Keyword-search fallback for when no AI provider is reachable (e.g.
 * exhausted credits on both Anthropic and xAI).
 *
 * Primary path: FTS5 virtual table (prisma/migrations/0002_properties_fts.sql),
 * OR-matched tokens ordered by bm25 rank. Last resort if the FTS table is
 * missing (migration not yet applied): plain `contains` filters. Neither path
 * uses `mode: "insensitive"` — SQLite LIKE and the default FTS5 tokenizer are
 * already case-insensitive for ASCII.
 */

import type { PrismaClient } from "@prisma/client";
import { D1_MAX_BOUND_PARAMS } from "../utils/constants";
import type { SearchFilters } from "./claude.service";

// Every FTS id becomes one bound parameter in the caller's Prisma
// `id IN (...)` clause (D1 hard-caps queries at 100 params — incident
// 2026-08-08: LIMIT 1000 here 503'd every fallback search with
// "D1_ERROR: too many SQL variables"). Headroom covers the year filter
// plus Prisma's own take/skip bindings around the id list.
const FTS_ID_PARAM_HEADROOM = 10;
const FTS_MAX_RESULTS = D1_MAX_BOUND_PARAMS - FTS_ID_PARAM_HEADROOM;

/**
 * Natural-language filler that carries no selectivity over this index. These
 * tokens are dropped before matching because OR-joining them dominated the
 * result set: measured against production D1, "properties in Austin worth
 * over 500k" matched 230,390 of 484,251 rows (48% of the table) and bm25
 * ranked business names containing "worth"/"over" (GAME OVER VIDEOGAMES,
 * WORTH HYDROCHEM) above every real Austin property.
 */
const QUERY_STOPWORDS = new Set([
	"properties",
	"in",
	"over",
	"worth",
	"with",
	"show",
	"me",
	"find",
	"all",
	"the",
	"a",
	"is",
	"are",
	"than",
]);

const THOUSAND = 1_000;
const MILLION = 1_000_000;

// "500k" / "1.2m" / "3 million" — the shorthand people actually type.
const VALUE_SUFFIX_MULTIPLIERS: Record<string, number> = {
	k: THOUSAND,
	m: MILLION,
	million: MILLION,
};

const LOWER_BOUND_WORDS = new Set([
	"over",
	"above",
	"more than",
	"greater than",
]);

/**
 * A value comparison plus its amount, e.g. "over $500k" or "under 1.2m".
 * Matched globally so "over 100k under 500k" yields both bounds.
 */
const VALUE_PHRASE_PATTERN =
	/\b(over|above|more than|greater than|under|below|less than)\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(k|m|million)?\b/gi;

export interface ValueBounds {
	/** Exclusive lower bound on appraisedValue, or null. */
	min: number | null;
	/** Exclusive upper bound on appraisedValue, or null. */
	max: number | null;
}

/**
 * Read value comparisons out of free text so the keyword fallback honours
 * them instead of dropping them silently. Without this, "worth over 500k"
 * returned properties appraised at $2,247 — relevant-looking and wrong.
 *
 * Compares against appraisedValue only; "assessed" is not distinguished.
 */
export function extractValueBounds(query: string): ValueBounds {
	const bounds: ValueBounds = { min: null, max: null };
	for (const [, comparator, digits, suffix] of query.matchAll(
		VALUE_PHRASE_PATTERN,
	)) {
		const multiplier = suffix
			? (VALUE_SUFFIX_MULTIPLIERS[suffix.toLowerCase()] ?? 1)
			: 1;
		const amount = Number.parseFloat(digits.replace(/,/g, "")) * multiplier;
		if (!Number.isFinite(amount)) continue;
		if (LOWER_BOUND_WORDS.has(comparator.toLowerCase())) {
			bounds.min = amount;
		} else {
			bounds.max = amount;
		}
	}
	return bounds;
}

/**
 * Remove the comparison phrases so their words and digits do not also become
 * FTS tokens — "500k" as a MATCH term only broadens the result set.
 */
export function stripValuePhrases(query: string): string {
	return query.replace(VALUE_PHRASE_PATTERN, " ");
}

/** Alphanumeric tokens with stopwords removed. */
export function extractSignalTokens(query: string): string[] {
	const tokens = query.toLowerCase().match(/[a-z0-9]+/g) ?? [];
	return tokens.filter((t) => !QUERY_STOPWORDS.has(t));
}

function hasBounds(bounds: ValueBounds): boolean {
	return bounds.min !== null || bounds.max !== null;
}

function boundsWhereClause(bounds: ValueBounds) {
	return {
		appraisedValue: {
			...(bounds.min !== null ? { gt: bounds.min } : {}),
			...(bounds.max !== null ? { lt: bounds.max } : {}),
		},
	};
}

function describeBounds(bounds: ValueBounds): string {
	const money = (n: number) => `$${n.toLocaleString("en-US")}`;
	if (bounds.min !== null && bounds.max !== null) {
		return `appraised between ${money(bounds.min)} and ${money(bounds.max)}`;
	}
	if (bounds.min !== null) return `appraised over ${money(bounds.min)}`;
	return `appraised under ${money(bounds.max as number)}`;
}

/**
 * Reduce free text to a safe FTS5 MATCH expression: bare alphanumeric
 * tokens, each quoted (neutralizes operators such as AND, OR, NOT, star,
 * caret), OR-joined so partial matches still rank rather than requiring
 * every word of a natural-language query to hit. Stopwords are removed
 * first so the remaining tokens actually drive the ranking.
 */
export function buildFtsMatchQuery(query: string): string {
	const tokens = query.toLowerCase().match(/[a-z0-9]+/g) ?? [];
	// If stopword removal empties the query (e.g. "show me all"), fall back to
	// the raw tokens — a weak search still beats no search.
	const signal = extractSignalTokens(query);
	const matched = signal.length > 0 ? signal : tokens;
	return matched.map((t) => `"${t}"`).join(" OR ");
}

export function buildKeywordSearchFilters(query: string): SearchFilters {
	const term = query.trim();
	const bounds = extractValueBounds(query);
	const textClause = {
		OR: [
			{ name: { contains: term } },
			{ propertyAddress: { contains: term } },
			{ city: { contains: term } },
			{ description: { contains: term } },
		],
	};
	const suffix = hasBounds(bounds) ? `, ${describeBounds(bounds)}` : "";
	return {
		whereClause: hasBounds(bounds)
			? { AND: [textClause, boundsWhereClause(bounds)] }
			: textClause,
		explanation: `Keyword search for "${term}" across owner name, address, city, and description${suffix} (AI search unavailable)`,
	};
}

/**
 * Resolve a keyword fallback to concrete SearchFilters. FTS5 result ids are
 * folded into an `id IN (...)` clause so the caller's existing pagination,
 * count, and transform pipeline applies unchanged.
 */
export async function searchKeywordFallback(
	prisma: PrismaClient,
	query: string,
	year: number,
): Promise<SearchFilters> {
	const bounds = extractValueBounds(query);
	const searchText = stripValuePhrases(query);

	// "properties over 500k" carries a bound but no searchable term — filter on
	// value alone rather than OR-matching the leftover stopwords.
	if (hasBounds(bounds) && extractSignalTokens(searchText).length === 0) {
		return {
			whereClause: boundsWhereClause(bounds),
			explanation: `Properties ${describeBounds(bounds)} (AI search unavailable; no other search terms recognized)`,
		};
	}

	const match = buildFtsMatchQuery(searchText);
	if (!match) {
		return buildKeywordSearchFilters(query);
	}
	const boundsSuffix = hasBounds(bounds) ? `, ${describeBounds(bounds)}` : "";
	try {
		// Bounds are applied here rather than in the returned where clause so
		// they narrow the set *before* LIMIT — filtering the top-ranked ids
		// afterwards would discard qualifying rows ranked below the cutoff.
		// Both bounds are always bound (null = no-op) to keep this a single
		// static statement with no interpolated SQL.
		const rows = await prisma.$queryRaw<Array<{ id: string }>>`
			SELECT p.id
			FROM properties_fts f
			JOIN properties p ON p.rowid = f.rowid
			WHERE properties_fts MATCH ${match} AND p.year = ${year}
			  AND (${bounds.min} IS NULL OR p.appraised_value > ${bounds.min})
			  AND (${bounds.max} IS NULL OR p.appraised_value < ${bounds.max})
			ORDER BY f.rank
			LIMIT ${FTS_MAX_RESULTS}
		`;
		return {
			whereClause: { id: { in: rows.map((r) => r.id) } },
			explanation: `Keyword search for "${query.trim()}" across owner name, address, city, and description${boundsSuffix} (AI search unavailable; top ${FTS_MAX_RESULTS} matches by relevance)`,
		};
	} catch (err) {
		// FTS table absent or MATCH rejected — degrade once more to LIKE.
		console.warn(
			`FTS5 keyword search unavailable, using contains filters: ${err instanceof Error ? err.message : String(err)}`,
		);
		return buildKeywordSearchFilters(query);
	}
}
