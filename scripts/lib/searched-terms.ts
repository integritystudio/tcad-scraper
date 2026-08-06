/** Shared utility for loading already-searched term sets across backfill and generation scripts. */

import { RECENT_JOBS_LOOKBACK_MS } from "../../utils/constants";
import { epochAgo, prisma } from "./d1-prisma";

export interface SearchedTermSets {
	/** All analytics terms + year=2025 properties + recent jobs. Use as the general "already tried" gate. */
	allSearched: Set<string>;
	/** Properties from year=2025 + recent jobs. Use for year-specific deduplication. */
	searched2025: Set<string>;
	/** Analytics terms that returned > 0 results. Use for superset filtering. */
	successful: Set<string>;
}

/**
 * Load all already-searched term sets in a single parallel query.
 * Results are lower-cased for consistent comparison.
 */
export async function getSearchedTermSets(): Promise<SearchedTermSets> {
	const [analyticsRows, propTermRows, recentJobs] = await Promise.all([
		prisma.searchTermAnalytics.findMany({
			select: { searchTerm: true, totalResults: true, successfulSearches: true },
		}),
		prisma.property.groupBy({
			by: ["searchTerm"],
			where: { year: 2025, searchTerm: { not: null } },
		}),
		prisma.scrapeJob.findMany({
			where: {
				startedAt: { gte: epochAgo(RECENT_JOBS_LOOKBACK_MS) },
			},
			select: { searchTerm: true },
		}),
	]);

	const allSearched = new Set<string>();
	const successful = new Set<string>();
	for (const r of analyticsRows) {
		// A term whose every attempt failed does not count as searched — the
		// March/April 2026 infra failures otherwise hid top-yield terms (David,
		// LIVING, Smith, ...) from the generator forever. Failed-only terms
		// become eligible again once outside the recent-jobs window.
		if (r.successfulSearches === 0 && r.totalResults === 0) continue;
		const lower = r.searchTerm.toLowerCase();
		allSearched.add(lower);
		if (r.totalResults > 0) successful.add(lower);
	}

	const searched2025 = new Set<string>();
	for (const r of propTermRows) {
		if (r.searchTerm) {
			const lower = r.searchTerm.toLowerCase();
			searched2025.add(lower);
			allSearched.add(lower);
		}
	}

	for (const j of recentJobs) {
		const lower = j.searchTerm.toLowerCase();
		searched2025.add(lower);
		allSearched.add(lower);
	}

	return { allSearched, searched2025, successful };
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
