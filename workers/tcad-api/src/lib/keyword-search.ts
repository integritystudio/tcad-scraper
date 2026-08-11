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
import {
	CITY_MATCH_MIN_ROWS,
	FTS_MAX_PAGE_SIZE,
	FTS_OR_RELAX_MAX_MATCHES,
} from "../utils/constants";
import { getErrorMessage } from "../utils/error-helpers";
import type { SearchFilters } from "./claude.service";

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
	// Superlative and quantity words. These describe an *ordering*, which
	// extractSortIntent below turns into an orderBy, and they carry essentially
	// no text signal of their own: measured against production D1 for year
	// 2025, "valuable" matches 0 rows, "most" 30 and "ten" 82, against
	// "austin"'s 171,187. Leaving them in is what made the OR relaxation keep
	// them and drop "austin" — ranking ~2,800 rows containing the literal token
	// "ten" and presenting that as the ten most valuable properties in Austin.
	"ten",
	"most",
	"least",
	"valuable",
	"expensive",
	"highest",
	"lowest",
	"cheapest",
	"priciest",
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
export function buildFtsMatchQuery(
	query: string,
	join: FtsJoin = "OR",
): string {
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
 * Run a COUNT-only MATCH query — no ORDER BY, no bm25 evaluation. This is
 * the cheap side of the COUNT-vs-ranked asymmetry that relaxToOr relies on
 * to decide whether a match is safe to rank before ever running the
 * expensive form (see FTS_OR_RELAX_MAX_MATCHES, utils/constants.ts).
 */
async function ftsCount(
	prisma: PrismaClient,
	match: string,
	year: number,
	bounds: ValueBounds,
): Promise<number> {
	const countRows = await prisma.$queryRaw<Array<{ total: number }>>`
		SELECT COUNT(*) AS total
		FROM properties_fts f
		JOIN properties p ON p.rowid = f.rowid
		WHERE properties_fts MATCH ${match} AND p.year = ${year}
		  AND (${bounds.min} IS NULL OR p.appraised_value > ${bounds.min})
		  AND (${bounds.max} IS NULL OR p.appraised_value < ${bounds.max})
	`;
	// COUNT(*) may return a BigInt from some D1 bindings.
	return Number(countRows[0]?.total ?? 0);
}

/**
 * Run the ranked, paginated MATCH query — the expensive form. Callers must
 * already know `match`'s row count is safe to rank (the AND-required match,
 * which is always at least as selective as any OR relaxation of the same
 * tokens; or an OR match already checked against FTS_OR_RELAX_MAX_MATCHES
 * via ftsCount) before calling this.
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
async function ftsRankedIds(
	prisma: PrismaClient,
	match: string,
	year: number,
	bounds: ValueBounds,
	limit: number,
	offset: number,
): Promise<string[]> {
	const pageRows = await prisma.$queryRaw<Array<{ id: string }>>`
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
	`;
	return pageRows.map((r) => r.id);
}

/**
 * Superlative phrasings that ask for an *ordering* rather than a text match.
 * Longest-first within each direction so "least expensive" is not read as
 * "expensive". Only value superlatives are listed: "largest"/"biggest" are
 * ambiguous between appraised value and acreage, so they are deliberately
 * absent and fall through to the text path rather than being guessed at.
 */
const DESC_SORT_PHRASES = [
	"most valuable",
	"most expensive",
	"highest appraised",
	"highest valued",
	"highest value",
	"top value",
	"priciest",
] as const;

const ASC_SORT_PHRASES = [
	"least valuable",
	"least expensive",
	"lowest appraised",
	"lowest valued",
	"lowest value",
	"cheapest",
] as const;

type SortDirection = "asc" | "desc";

interface SortIntent {
	direction: SortDirection;
	/** The matched phrase, removed from the text before tokenizing the subject. */
	phrase: string;
}

/**
 * Recognize "the ten most valuable properties in Austin" as an ordering over
 * appraisedValue rather than as words to match. Keyword search cannot answer a
 * superlative at all — the answer is not the rows containing these words, it is
 * the rows ranked by a column — so detecting it is what lets the fallback
 * synthesize a real query instead of returning bm25 noise.
 */
export function extractSortIntent(query: string): SortIntent | null {
	const lower = query.toLowerCase();
	for (const phrase of DESC_SORT_PHRASES) {
		if (lower.includes(phrase)) return { direction: "desc", phrase };
	}
	for (const phrase of ASC_SORT_PHRASES) {
		if (lower.includes(phrase)) return { direction: "asc", phrase };
	}
	return null;
}

/**
 * Remove the matched superlative so it cannot be mistaken for part of the
 * subject. Case-insensitive because extractSortIntent matched against a
 * lowercased copy while the caller still holds the original text.
 */
function stripSortPhrase(text: string, phrase: string): string {
	const index = text.toLowerCase().indexOf(phrase);
	if (index === -1) return text;
	return `${text.slice(0, index)} ${text.slice(index + phrase.length)}`;
}

/**
 * Candidate city names from the subject tokens: each token, plus each adjacent
 * pair, since several Travis County municipalities are two words (DEL VALLE,
 * LAGO VISTA, CEDAR PARK) and would never match a single-token equality.
 */
function cityCandidates(tokens: string[]): string[] {
	const candidates = tokens.map((t) => t.toUpperCase());
	for (let i = 0; i + 1 < tokens.length; i++) {
		candidates.push(`${tokens[i]} ${tokens[i + 1]}`.toUpperCase());
	}
	return candidates;
}

/**
 * Resolve which subject token names a city, by equality against the indexed
 * `city` column. Equality is the whole point: `city = 'AUSTIN'` uses
 * properties_city_appraised_value_idx and returned the top 10 by value in 8.9ms
 * on production D1, while `city LIKE 'AUSTIN%'` cannot use that index at all
 * (SQLite will not drive a BINARY-collation index from a case-insensitive LIKE)
 * and took 5,323ms for the same rows — a ~600x difference.
 *
 * The highest-count candidate wins rather than the first: "Austin, TX" offers
 * both "AUSTIN" (157,187 rows) and "TX" (25), and the larger is the one the
 * user named. CITY_MATCH_MIN_ROWS then rejects typo and artifact values.
 */
async function resolveCityFilter(
	prisma: PrismaClient,
	tokens: string[],
	year: number,
): Promise<{ city: string; rows: number } | null> {
	if (tokens.length === 0) return null;
	const counted = await Promise.all(
		cityCandidates(tokens).map(async (city) => ({
			city,
			rows: await prisma.property.count({ where: { year, city } }),
		})),
	);
	const viable = counted
		.filter((c) => c.rows >= CITY_MATCH_MIN_ROWS)
		.sort((a, b) => b.rows - a.rows);
	return viable[0] ?? null;
}

type RelaxOutcome =
	| { mode: "or"; page: FtsPage }
	| { mode: "too-broad"; matchCount: number };

/**
 * Relax an AND match that returned nothing to OR, without ever handing D1 an
 * unrankable set. Measured against production D1, the OR expression for
 * "ten most valuable properties in Austin, TX" ("ten" OR "most" OR "valuable"
 * OR "austin" OR "tx") matched 172,464 of ~978k rows: the COUNT for that set
 * finished in 4.9s, but ranking it — ORDER BY bm25(...) over all 172,464
 * rows — failed with "D1 DB exceeded its CPU time limit and was reset" when
 * run from inside the Worker (it only succeeded over the slower REST API
 * path, in 6.6s). So the full OR set is counted first — the cheap form, with
 * no bm25 — and only ranked if that count is within FTS_OR_RELAX_MAX_MATCHES.
 *
 * Past the bound it reports too-broad rather than ranking a subset of the
 * tokens. Dropping the least-frequent tokens was tried and reverted: in this
 * corpus the frequent tokens are the meaningful ones, so it kept the noise and
 * discarded the intent — for the query above it retained "valuable" (0 rows),
 * "most" (30) and "ten" (82) while dropping "austin" (171,187), then ranked
 * ~2,800 rows containing the literal token "ten" and presented them as the ten
 * most valuable properties in Austin. Junk that looks like an answer is worse
 * than a stated refusal. It also cost a COUNT per token to decide, and the
 * count for "austin" alone measured 10.6s.
 *
 * Superlative phrasings never reach here at all — searchKeywordFallback
 * answers those with a structured city-plus-ordering query instead.
 */
async function relaxToOr(
	prisma: PrismaClient,
	searchText: string,
	year: number,
	bounds: ValueBounds,
	limit: number,
	offset: number,
): Promise<RelaxOutcome> {
	const fullOrMatch = buildFtsMatchQuery(searchText, "OR");
	const fullOrTotal = await ftsCount(prisma, fullOrMatch, year, bounds);

	if (fullOrTotal > FTS_OR_RELAX_MAX_MATCHES) {
		return { mode: "too-broad", matchCount: fullOrTotal };
	}

	const ids = await ftsRankedIds(
		prisma,
		fullOrMatch,
		year,
		bounds,
		limit,
		offset,
	);
	return { mode: "or", page: { ids, total: fullOrTotal } };
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

	const boundsSuffix = hasBounds(bounds) ? `, ${describeBounds(bounds)}` : "";

	// A superlative is an ordering, not a text match, so answer it with a real
	// query: `city = ? ORDER BY appraised_value` over the composite index. The
	// text path cannot answer it even in principle — bm25 ranks by term
	// relevance, not by value — and trying produced the exact failure this
	// branch exists to prevent.
	const sort = extractSortIntent(query);
	if (sort) {
		const orderBy = { appraisedValue: sort.direction };
		const ordering = sort.direction === "desc" ? "most" : "least";
		const subjectTokens = extractSignalTokens(
			stripSortPhrase(searchText, sort.phrase),
		);
		const city = await resolveCityFilter(prisma, subjectTokens, year);
		if (city) {
			return {
				whereClause: hasBounds(bounds)
					? { AND: [{ city: city.city }, boundsWhereClause(bounds)] }
					: { city: city.city },
				orderBy,
				explanation: `Properties in ${city.city} ordered by appraised value, ${ordering} valuable first${boundsSuffix} (AI search unavailable)`,
			};
		}
		if (subjectTokens.length === 0) {
			// "the ten most valuable properties" — no subject to narrow by, so
			// order the whole roll year. Still a real answer to the question.
			return {
				whereClause: hasBounds(bounds) ? boundsWhereClause(bounds) : {},
				orderBy,
				explanation: `All properties ordered by appraised value, ${ordering} valuable first${boundsSuffix} (AI search unavailable)`,
			};
		}
		// A superlative over a subject that is not a city — "most valuable
		// properties on Congress Ave". Ranking the subject's text matches by
		// bm25 would answer a different question, and ordering a single 98-row
		// FTS page by value would report "most valuable" over an arbitrary
		// slice. Say so instead of inventing an answer.
		return {
			whereClause: { id: { in: [] } },
			precomputedTotal: 0,
			explanation: `Cannot answer "${query.trim()}" without AI search: ranking by appraised value is only supported for a city or the whole roll, and "${subjectTokens.join(" ")}" does not name a city (AI search unavailable)`,
		};
	}

	const requireAll = buildFtsMatchQuery(searchText, "AND");
	if (!requireAll) {
		return buildKeywordSearchFilters(query);
	}
	try {
		// Count before ranking on this path too, not just the OR relax below: a
		// single broad token is its own AND expression, so "properties in Austin"
		// arrives here as `"austin"` — 171,187 rows — and ranking that trips the
		// same CPU limit the OR guard was added for.
		const andTotal = await ftsCount(prisma, requireAll, year, bounds);
		if (andTotal > FTS_OR_RELAX_MAX_MATCHES) {
			return {
				whereClause: { id: { in: [] } },
				precomputedTotal: 0,
				explanation: `Keyword search for "${query.trim()}" matched too many properties to rank (${andTotal.toLocaleString()}, over the ${FTS_OR_RELAX_MAX_MATCHES.toLocaleString()}-row limit) — try a more specific term (AI search unavailable)`,
			};
		}
		const andPage: FtsPage = {
			ids:
				andTotal === 0
					? []
					: await ftsRankedIds(prisma, requireAll, year, bounds, limit, offset),
			total: andTotal,
		};

		// Requiring every token is far more selective — measured on production
		// D1, "oak street" matches 14 rows as AND against 12,153 as OR, so an
		// OR-only set fills its page with rows that hit just one token. But
		// plausible queries ("zilker park trust") match nothing as AND, so relax
		// to OR rather than returning empty. Only worth a second query when
		// there is more than one token to relax.
		if (andPage.total !== 0 || matchTokens(searchText).length <= 1) {
			return {
				whereClause: { id: { in: andPage.ids } },
				explanation: `Keyword search for "${query.trim()}" across owner names, DBA, address, city, and description${boundsSuffix} — matching all terms (AI search unavailable)`,
				precomputedTotal: andPage.total,
			};
		}

		const outcome = await relaxToOr(
			prisma,
			searchText,
			year,
			bounds,
			limit,
			offset,
		);

		if (outcome.mode === "too-broad") {
			// Every token, even alone, matched more rows than can be safely
			// ranked. Returning zero here is a deliberate, cheap answer: the
			// catch block's LIKE `contains` fallback below costs ~40s and, on
			// this exact class of query, also returns 0 rows — there is
			// nothing to gain by falling through to it.
			return {
				whereClause: { id: { in: [] } },
				explanation: `Keyword search for "${query.trim()}" matched too many properties to rank (${outcome.matchCount.toLocaleString()}, over the ${FTS_OR_RELAX_MAX_MATCHES.toLocaleString()}-row limit) — try a more specific term (AI search unavailable)`,
				precomputedTotal: 0,
			};
		}

		const matchNote = "matching any term, as no property matched all of them";

		return {
			whereClause: { id: { in: outcome.page.ids } },
			explanation: `Keyword search for "${query.trim()}" across owner names, DBA, address, city, and description${boundsSuffix} — ${matchNote} (AI search unavailable)`,
			precomputedTotal: outcome.page.total,
		};
	} catch (err) {
		// FTS table absent or MATCH rejected — degrade once more to LIKE.
		console.warn(
			`FTS5 keyword search unavailable, using contains filters: ${getErrorMessage(err)}`,
		);
		return buildKeywordSearchFilters(query);
	}
}
