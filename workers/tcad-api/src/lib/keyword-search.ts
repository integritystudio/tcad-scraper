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

// FTS page ids are folded into the data-fetch's `id IN (...)` clause plus a
// `year = ?` binding — D1 hard-caps queries at 100 bound params (incident
// 2026-08-08). Reserve 2 slots for year + safety, leaving 98 for ids.
const FTS_PAGE_ID_HEADROOM = 2;
export const FTS_MAX_PAGE_SIZE = D1_MAX_BOUND_PARAMS - FTS_PAGE_ID_HEADROOM; // 98

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

/**
 * bm25 column weights, in the order the columns are declared by
 * prisma/migrations/0004_fts_owner_columns.sql — reordering that migration
 * silently reweights search. The column list is:
 *   name, property_address, city, description,
 *   owner_name, name_secondary, dba  (added in 0004, T14 2026-08-08)
 *
 * `description` holds legal plat text ("UNT 20 GABARDINE CONDOMINIUMS
 * AMENDED PLUS .7722 % INT IN COM AREA"), which TCAD's own search does not
 * even cover. Unweighted, it dominates: measured on production D1,
 * "condominium" filled 18 of the top 20 with description-only matches and
 * buried the 25 rows whose owner name or address actually says it —
 * weighting drops that to 0 of 20. Terms that exist *only* in description
 * (RESUB, subdivision names) are unaffected; there is nothing else to
 * promote, so they still rank among themselves.
 *
 * `owner_name`, `name_secondary`, and `dba` are owner-identity columns and
 * ranked near `name` (10.0) so searching by a DBA or co-owner name surfaces
 * matching properties above description-only matches.
 */
const FTS_BM25_WEIGHTS = {
	name: 10.0,
	propertyAddress: 8.0,
	city: 4.0,
	description: 1.0,
	ownerName: 9.0,
	nameSecondary: 9.0,
	dba: 9.0,
} as const;

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

interface FtsPage {
	ids: string[];
	total: number;
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

/** How multiple tokens combine in a MATCH expression. */
export type FtsJoin = "AND" | "OR";

/**
 * Tokens actually used for matching: signal tokens, or the raw tokens if
 * stopword removal emptied the query ("show me all the properties") — a weak
 * search still beats no search.
 */
function matchTokens(query: string): string[] {
	const tokens = query.toLowerCase().match(/[a-z0-9]+/g) ?? [];
	const signal = extractSignalTokens(query);
	return signal.length > 0 ? signal : tokens;
}

/**
 * Reduce free text to a safe FTS5 MATCH expression: bare alphanumeric
 * tokens, each quoted (neutralizes operators such as AND, OR, NOT, star,
 * caret), joined by `join`. Stopwords are removed first so the remaining
 * tokens actually drive the ranking.
 */
export function buildFtsMatchQuery(query: string, join: FtsJoin = "OR"): string {
	return matchTokens(query)
		.map((t) => `"${t}"`)
		.join(` ${join} `);
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
 * Run one MATCH expression and return a ranked page of ids plus the true
 * total match count. Pagination happens in SQL (LIMIT/OFFSET) so the caller
 * does not need to fold a large id list into `id IN (...)` — avoiding D1's
 * 100-param bound limit (incident 2026-08-08). Both queries run in parallel.
 *
 * Bounds are applied inside SQL rather than in the returned where clause so
 * they narrow the set *before* LIMIT — filtering top-ranked ids afterwards
 * would discard qualifying rows ranked below the cutoff. Both bounds are
 * always bound (null = no-op) to keep the statements static with no
 * interpolated SQL.
 *
 * bm25()'s first argument must be the FTS table *name*, not the `f` alias —
 * D1 rejects `bm25(f, ...)` with "no such column: f".
 */
async function ftsQueryPage(
	prisma: PrismaClient,
	match: string,
	year: number,
	bounds: ValueBounds,
	limit: number,
	offset: number,
): Promise<FtsPage> {
	const [pageRows, countRows] = await Promise.all([
		prisma.$queryRaw<Array<{ id: string }>>`
			SELECT p.id
			FROM properties_fts f
			JOIN properties p ON p.rowid = f.rowid
			WHERE properties_fts MATCH ${match} AND p.year = ${year}
			  AND (${bounds.min} IS NULL OR p.appraised_value > ${bounds.min})
			  AND (${bounds.max} IS NULL OR p.appraised_value < ${bounds.max})
			ORDER BY bm25(
				properties_fts,
				${FTS_BM25_WEIGHTS.name},
				${FTS_BM25_WEIGHTS.propertyAddress},
				${FTS_BM25_WEIGHTS.city},
				${FTS_BM25_WEIGHTS.description},
				${FTS_BM25_WEIGHTS.ownerName},
				${FTS_BM25_WEIGHTS.nameSecondary},
				${FTS_BM25_WEIGHTS.dba}
			)
			LIMIT ${limit} OFFSET ${offset}
		`,
		prisma.$queryRaw<Array<{ total: number }>>`
			SELECT COUNT(*) AS total
			FROM properties_fts f
			JOIN properties p ON p.rowid = f.rowid
			WHERE properties_fts MATCH ${match} AND p.year = ${year}
			  AND (${bounds.min} IS NULL OR p.appraised_value > ${bounds.min})
			  AND (${bounds.max} IS NULL OR p.appraised_value < ${bounds.max})
		`,
	]);
	return {
		ids: pageRows.map((r) => r.id),
		// COUNT(*) may return a BigInt from some D1 bindings.
		total: Number(countRows[0]?.total ?? 0),
	};
}

/**
 * Resolve a keyword fallback to concrete SearchFilters. Pagination and the
 * true total count are computed inside SQL (LIMIT/OFFSET + COUNT(*)), so
 * neither the result ceiling nor the reported total is capped by D1's
 * 100-param bound limit (T13, 2026-08-08).
 *
 * When `precomputedTotal` is present in the returned object the caller should:
 *  - use that value as `total` instead of running `prisma.property.count`
 *  - NOT apply `skip`/`take` to the `findMany` — the page is already correct
 */
export async function searchKeywordFallback(
	prisma: PrismaClient,
	query: string,
	year: number,
	limit = FTS_MAX_PAGE_SIZE,
	offset = 0,
): Promise<SearchFilters & { precomputedTotal?: number }> {
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

	const requireAll = buildFtsMatchQuery(searchText, "AND");
	if (!requireAll) {
		return buildKeywordSearchFilters(query);
	}
	const boundsSuffix = hasBounds(bounds) ? `, ${describeBounds(bounds)}` : "";
	try {
		let page = await ftsQueryPage(prisma, requireAll, year, bounds, limit, offset);
		let relaxed = false;

		// Requiring every token is far more selective — measured on production
		// D1, "oak street" matches 14 rows as AND against 12,153 as OR, so an
		// OR-only set fills its page with rows that hit just one token. But
		// plausible queries ("zilker park trust") match nothing as AND, so relax
		// to OR rather than returning empty. Only worth a second query when
		// there is more than one token to relax.
		if (page.total === 0 && matchTokens(searchText).length > 1) {
			page = await ftsQueryPage(
				prisma,
				buildFtsMatchQuery(searchText, "OR"),
				year,
				bounds,
				limit,
				offset,
			);
			relaxed = true;
		}

		const matchNote = relaxed
			? "matching any term, as no property matched all of them"
			: "matching all terms";
		return {
			whereClause: { id: { in: page.ids } },
			explanation: `Keyword search for "${query.trim()}" across owner names, DBA, address, city, and description${boundsSuffix} — ${matchNote} (AI search unavailable)`,
			precomputedTotal: page.total,
		};
	} catch (err) {
		// FTS table absent or MATCH rejected — degrade once more to LIKE.
		console.warn(
			`FTS5 keyword search unavailable, using contains filters: ${err instanceof Error ? err.message : String(err)}`,
		);
		return buildKeywordSearchFilters(query);
	}
}
