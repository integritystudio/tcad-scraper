/**
 * Backfill 2025 TCAD properties using PROVEN high-yield terms.
 *
 * These terms already returned 100+ results for 2026 but have never been
 * queried for 2025. Re-querying them with TCAD_YEAR=2025 should capture
 * the bulk of missing 2025 properties.
 *
 * Usage: TCAD_YEAR=2025 doppler run -- npx tsx src/scripts/backfill-2025-proven.ts
 */

import { prisma } from "../lib/prisma";
import { scraperQueue } from "../queues/scraper.queue";
import { config } from "../config";
import { getErrorMessage } from "../utils/error-helpers";
import { RECENT_JOBS_LOOKBACK_DAYS, RECENT_JOBS_LOOKBACK_MS, TARGET_2025_PROPERTY_COUNT as TARGET_2025_COUNT } from "./lib/backfill-constants";
import { enqueueBatch, waitForQueueDrain, BATCH_SIZE } from "./lib/queue-utils";
const MAX_CONSECUTIVE_ZERO_BATCHES = 3;
const MIN_2026_YIELD = 100;

async function get2025Count(): Promise<number> {
  // ::int cast required: Prisma $queryRaw returns BigInt for COUNT(*); cast to int before JS receives it.
  // If this cast is removed, the `number` type annotation will silently lie (BigInt !== number).
  const result = await prisma.$queryRaw<[{ count: number }]>`
    SELECT COUNT(*)::int as count FROM properties WHERE year = 2025`;
  return result[0].count;
}

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

async function main() {
  if (config.scraper.tcadYear !== 2025) {
    console.error(`ERROR: TCAD_YEAR is ${config.scraper.tcadYear}, must be 2025.`);
    console.error("Run with: TCAD_YEAR=2025 doppler run -- npx tsx src/scripts/backfill-2025-proven.ts");
    process.exit(1);
  }

  let current = await get2025Count();
  console.log(`\n=== 2025 Backfill (Proven 2026 Terms) ===`);
  console.log(`Current 2025 properties: ${current.toLocaleString()}`);
  console.log(`Target: ${TARGET_2025_COUNT.toLocaleString()}`);
  console.log(`Gap: ${(TARGET_2025_COUNT - current).toLocaleString()}\n`);

  if (current >= TARGET_2025_COUNT) {
    console.log("Already at target.");
    return;
  }

  const allTerms = await getProvenTerms();
  console.log(`\nTerms to backfill: ${allTerms.length}\n`);

  if (allTerms.length === 0) {
    console.log("No proven terms remaining.");
    return;
  }

  let batchNum = 0;
  let consecutiveZeroBatches = 0;
  let totalGained = 0;
  for (let i = 0; i < allTerms.length; i += BATCH_SIZE) {
    current = await get2025Count();
    if (current >= TARGET_2025_COUNT) {
      console.log(`\nTarget reached: ${current.toLocaleString()} >= ${TARGET_2025_COUNT.toLocaleString()}`);
      break;
    }

    batchNum++;
    const batch = allTerms.slice(i, i + BATCH_SIZE);
    console.log(`--- Batch ${batchNum} (${batch.length} terms) ---`);
    console.log(`  Terms: ${batch.join(", ")}`);

    const enqueued = await enqueueBatch(batch, "backfill-2025-proven");
    console.log(`  Enqueued: ${enqueued}`);

    await waitForQueueDrain();

    const newCount = await get2025Count();
    const gained = newCount - current;
    totalGained += gained;
    console.log(`  2025 properties: ${newCount.toLocaleString()} (+${gained.toLocaleString()}) [session: +${totalGained.toLocaleString()}]`);
    console.log(`  Remaining: ${Math.max(0, TARGET_2025_COUNT - newCount).toLocaleString()}`);

    if (gained === 0) {
      consecutiveZeroBatches++;
      console.log(`  Zero-result batches: ${consecutiveZeroBatches}/${MAX_CONSECUTIVE_ZERO_BATCHES}`);
      if (consecutiveZeroBatches >= MAX_CONSECUTIVE_ZERO_BATCHES) {
        console.log(`\nStopping: ${MAX_CONSECUTIVE_ZERO_BATCHES} consecutive zero-result batches.`);
        break;
      }
    } else {
      consecutiveZeroBatches = 0;
    }
    console.log("");
  }

  const finalCount = await get2025Count();
  console.log(`\n=== Done ===`);
  console.log(`Final 2025 count: ${finalCount.toLocaleString()}`);
  console.log(`Session gained: +${totalGained.toLocaleString()}`);
  console.log(`Target met: ${finalCount >= TARGET_2025_COUNT ? "YES" : "NO"}`);
}

main()
  .catch(err => {
    console.error("Fatal:", getErrorMessage(err));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await scraperQueue.close();
  });
