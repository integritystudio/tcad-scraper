/**
 * Keyword-search fallback for when no AI provider is reachable (e.g.
 * exhausted credits on both Anthropic and OpenAI).
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
 * Reduce free text to a safe FTS5 MATCH expression: bare alphanumeric
 * tokens, each quoted (neutralizes operators such as AND, OR, NOT, star,
 * caret), OR-joined so partial matches still rank rather than requiring
 * every word of a natural-language query to hit.
 */
export function buildFtsMatchQuery(query: string): string {
	const tokens = query.toLowerCase().match(/[a-z0-9]+/g) ?? [];
	return tokens.map((t) => `"${t}"`).join(" OR ");
}

export function buildKeywordSearchFilters(query: string): SearchFilters {
	const term = query.trim();
	return {
		whereClause: {
			OR: [
				{ name: { contains: term } },
				{ propertyAddress: { contains: term } },
				{ city: { contains: term } },
				{ description: { contains: term } },
			],
		},
		explanation: `Keyword search for "${term}" across owner name, address, city, and description (AI search unavailable)`,
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
	const match = buildFtsMatchQuery(query);
	if (!match) {
		return buildKeywordSearchFilters(query);
	}
	try {
		const rows = await prisma.$queryRaw<Array<{ id: string }>>`
			SELECT p.id
			FROM properties_fts f
			JOIN properties p ON p.rowid = f.rowid
			WHERE properties_fts MATCH ${match} AND p.year = ${year}
			ORDER BY f.rank
			LIMIT ${FTS_MAX_RESULTS}
		`;
		return {
			whereClause: { id: { in: rows.map((r) => r.id) } },
			explanation: `Keyword search for "${query.trim()}" across owner name, address, city, and description (AI search unavailable; top ${FTS_MAX_RESULTS} matches by relevance)`,
		};
	} catch (err) {
		// FTS table absent or MATCH rejected — degrade once more to LIKE.
		console.warn(
			`FTS5 keyword search unavailable, using contains filters: ${err instanceof Error ? err.message : String(err)}`,
		);
		return buildKeywordSearchFilters(query);
	}
}
