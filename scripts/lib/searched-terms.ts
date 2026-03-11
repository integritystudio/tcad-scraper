/** Shared utility for loading already-searched term sets across backfill and generation scripts. */

import { prisma } from "../../server/src/lib/prisma";
import { RECENT_JOBS_LOOKBACK_MS } from "../../utils/constants";

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
      select: { searchTerm: true, totalResults: true },
    }),
    prisma.property.groupBy({
      by: ["searchTerm"],
      where: { year: 2025, searchTerm: { not: null } },
    }),
    prisma.scrapeJob.findMany({
      where: { startedAt: { gte: new Date(Date.now() - RECENT_JOBS_LOOKBACK_MS) } },
      select: { searchTerm: true },
    }),
  ]);

  const allSearched = new Set<string>();
  const successful = new Set<string>();
  for (const r of analyticsRows) {
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
