/**
 * Backfill 2025 TCAD properties using PROVEN high-yield terms.
 *
 * These terms already returned 100+ results for 2026 but have never been
 * queried for 2025. Re-querying them with TCAD_YEAR=2025 should capture
 * the bulk of missing 2025 properties.
 *
 * Usage: TCAD_YEAR=2025 doppler run -- npx tsx scripts/backfill-2025-proven.ts
 */

import { prisma } from "../server/src/lib/prisma";
import { RECENT_JOBS_LOOKBACK_DAYS, RECENT_JOBS_LOOKBACK_MS } from "../utils/constants";
import { runBackfillMain } from "./lib/backfill-runner";

const MIN_2026_YIELD = 100;

async function getProvenTerms(): Promise<string[]> {
  // Terms that yielded 100+ properties in 2026 but have 0 in 2025
  const terms = await prisma.$queryRaw<Array<{ term: string; y26: number }>>`
    SELECT p26.search_term as term, p26.cnt::int as y26
    FROM (
      SELECT search_term, COUNT(DISTINCT property_id) as cnt
      FROM properties WHERE year = 2026
      GROUP BY search_term
      HAVING COUNT(DISTINCT property_id) >= ${MIN_2026_YIELD}
    ) p26
    LEFT JOIN (
      SELECT search_term, COUNT(DISTINCT property_id) as cnt
      FROM properties WHERE year = 2025
      GROUP BY search_term
    ) p25 ON p26.search_term = p25.search_term
    WHERE COALESCE(p25.cnt, 0) = 0
    ORDER BY p26.cnt DESC`;

  // Also exclude terms already attempted today (scrape_jobs)
  const recentJobs = await prisma.scrapeJob.findMany({
    where: { startedAt: { gte: new Date(Date.now() - RECENT_JOBS_LOOKBACK_MS) } },
    select: { searchTerm: true },
  });
  const attempted = new Set(recentJobs.map(j => j.searchTerm.toLowerCase()));

  const result: string[] = [];
  let skipped = 0;
  for (const t of terms) {
    if (attempted.has(t.term.toLowerCase())) { skipped++; continue; }
    result.push(t.term);
  }

  console.log(`  Proven terms (${MIN_2026_YIELD}+ yield in 2026, 0 in 2025): ${terms.length}`);
  console.log(`  Skipped (attempted in last ${RECENT_JOBS_LOOKBACK_DAYS} days): ${skipped}`);
  console.log(`  Queued: ${result.length}`);
  return result;
}

runBackfillMain({
  getTerms: getProvenTerms,
  userId: "backfill-2025-proven",
  label: "Proven 2026 Terms",
});
