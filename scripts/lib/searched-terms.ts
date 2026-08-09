/** Shared utility for loading already-searched term sets across backfill and generation scripts. */

import {
	DEFAULT_TCAD_YEAR,
	RECENT_JOBS_LOOKBACK_MS,
} from "../../utils/constants";
import { epochAgo, prisma } from "./d1-prisma";

export interface SearchedTermSets {
	/** All analytics terms + the requested year's properties + recent jobs. Use as the general "already tried" gate. */
	allSearched: Set<string>;
	/** Properties from the requested year + recent jobs. Use for year-specific deduplication. */
	searchedForYear: Set<string>;
	/** Analytics terms that returned > 0 results. Use for superset filtering. */
	successful: Set<string>;
	/**
	 * Analytics terms recorded with totalResults = 0 — i.e. every completed
	 * search for this term saved zero NEW properties (totalResults is a pure
	 * increment-on-save counter, see scraper.workflow.ts's update-analytics
	 * step). Confirmed by audit (2026-08-07) that this reflects real
	 * saturation, not broken data: e.g. "Maria" has thousands of TCAD
	 * matches, but every one was already in D1 under another search term by
	 * the time "Maria" itself completed.
	 *
	 * IMPORTANT — this set is year-blind and must NOT gate a year that has
	 * not been scraped yet. `search_term_analytics` has no year column
	 * (`@@unique([searchTerm])`), so the counter aggregates every year ever
	 * scraped. Saturation is a property of a (term, year) pair, not of a
	 * term: "Maria" saved 0 new rows for 2025 precisely because 2025 was
	 * already dense, and would save several thousand against an empty 2026.
	 * Excluding these terms from a fresh year's backfill would skip exactly
	 * its highest-yield vocabulary. Use `getYearYield(year)` for a
	 * year-correct saturation signal.
	 */
	unsuccessful: Set<string>;
}

/**
 * Load all already-searched term sets in a single parallel query.
 * Results are lower-cased for consistent comparison.
 *
 * @param year Tax year whose scraped properties define `searchedForYear`.
 */
export async function getSearchedTermSets(
	year: number = DEFAULT_TCAD_YEAR,
): Promise<SearchedTermSets> {
	const [analyticsRows, propTermRows, recentJobs] = await Promise.all([
		prisma.searchTermAnalytics.findMany({
			select: {
				searchTerm: true,
				totalResults: true,
				successfulSearches: true,
			},
		}),
		prisma.property.groupBy({
			by: ["searchTerm"],
			where: { year, searchTerm: { not: null } },
		}),
		// Scoped to `year` (migration 0005) so a run filling one roll year is
		// not blocked by in-flight jobs for another. Rows predating 0005 were
		// backfilled to 2025, so no job is silently year-less.
		prisma.scrapeJob.findMany({
			where: {
				year,
				startedAt: { gte: epochAgo(RECENT_JOBS_LOOKBACK_MS) },
			},
			select: { searchTerm: true },
		}),
	]);

	const allSearched = new Set<string>();
	const successful = new Set<string>();
	const unsuccessful = new Set<string>();
	for (const r of analyticsRows) {
		const lower = r.searchTerm.toLowerCase();
		if (r.totalResults > 0) {
			successful.add(lower);
		} else {
			unsuccessful.add(lower);
		}
		// A term whose every attempt failed does not count as searched — the
		// March/April 2026 infra failures otherwise hid top-yield terms (David,
		// LIVING, Smith, ...) from the generator forever. Failed-only terms
		// become eligible again once outside the recent-jobs window.
		if (r.successfulSearches === 0 && r.totalResults === 0) continue;
		allSearched.add(lower);
	}

	const searchedForYear = new Set<string>();
	for (const r of propTermRows) {
		if (r.searchTerm) {
			const lower = r.searchTerm.toLowerCase();
			searchedForYear.add(lower);
			allSearched.add(lower);
		}
	}

	for (const j of recentJobs) {
		const lower = j.searchTerm.toLowerCase();
		searchedForYear.add(lower);
		allSearched.add(lower);
	}

	return { allSearched, searchedForYear, successful, unsuccessful };
}

/**
 * Distinct properties attributed to each search term for one tax year —
 * the year-correct counterpart to the year-blind `successful`/`unsuccessful`
 * sets above.
 *
 * `properties.search_term` records the term whose scrape wrote the row, so
 * the counts partition the year's corpus: every property appears under
 * exactly one term, and the terms with a non-zero count cover the year
 * completely. That makes this both the per-year saturation signal and the
 * ground truth the coverage optimizer plans against.
 *
 * Caveat: the attribution is first-writer-wins, not "the only term that
 * matches". A property matched by ten terms is credited to one, so a term's
 * count is a lower bound on what it would return from TCAD.
 */
export async function getYearYield(year: number): Promise<Map<string, number>> {
	const rows = await prisma.$queryRaw<
		Array<{ search_term: string | null; cnt: number | bigint }>
	>`
    SELECT search_term, COUNT(DISTINCT property_id) AS cnt
    FROM properties
    WHERE year = ${year} AND search_term IS NOT NULL
    GROUP BY search_term
    ORDER BY cnt DESC`;

	const yields = new Map<string, number>();
	for (const r of rows) {
		if (r.search_term) yields.set(r.search_term, Number(r.cnt));
	}
	return yields;
}

/**
 * Terms that completed a scrape for `year` and saved nothing for it — the
 * year-scoped replacement for the year-blind `unsuccessful` set.
 *
 * `search_term_analytics` cannot answer this: it has one row per term across
 * all years, so a term saturated in 2025 is indistinguishable from one that
 * is saturated everywhere. Joining `scrape_jobs` (year-stamped since
 * migration 0005) against the year's attributed properties gives the real
 * per-year signal, and is safe to use as a backfill exclusion — the term was
 * genuinely tried against this roll year and returned nothing new.
 *
 * Lower-cased for consistent comparison.
 */
export async function getYearZeroYieldTerms(
	year: number,
): Promise<Set<string>> {
	const rows = await prisma.$queryRaw<Array<{ search_term: string }>>`
    SELECT DISTINCT j.search_term AS search_term
    FROM scrape_jobs j
    LEFT JOIN (
      SELECT LOWER(search_term) AS lterm, COUNT(*) AS cnt
      FROM properties
      WHERE year = ${year} AND search_term IS NOT NULL
      GROUP BY LOWER(search_term)
    ) p ON LOWER(j.search_term) = p.lterm
    WHERE j.year = ${year}
      AND j.status = 'completed'
      AND COALESCE(p.cnt, 0) = 0`;
	return new Set(rows.map((r) => r.search_term.toLowerCase()));
}

/** Failures before a zero-yield term is treated as a permanent dud. */
const BLACKLIST_MIN_SEARCHES = 3;

/**
 * Terms searched BLACKLIST_MIN_SEARCHES+ times with zero success — hard skip.
 * Complements the failed-only carve-out in getSearchedTermSets(): failed-only
 * terms are generally retryable, but one that failed this many times is not.
 * Lower-cased for consistent comparison.
 */
export async function getBlacklistedTermSet(): Promise<Set<string>> {
	const rows = await prisma.searchTermAnalytics.findMany({
		where: { successRate: 0, totalSearches: { gte: BLACKLIST_MIN_SEARCHES } },
		select: { searchTerm: true },
	});
	return new Set(rows.map((r) => r.searchTerm.toLowerCase()));
}
