/**
 * Enqueue prefix expansion terms with auto-stop on 3 consecutive zero unique property results.
 *
 * Waits for each batch to complete before enqueuing the next, tracking new properties.
 * Stops early if 3 consecutive terms yield 0 new unique properties.
 *
 * Usage: doppler run -- npx tsx scripts/enqueue-prefix-expansions.ts
 */

import { prisma } from '../server/src/lib/prisma';
import { scraperQueue } from '../server/src/queues/scraper.queue';
import { config } from '../server/src/config';
import { enqueueBatch, waitForQueueDrain } from './lib/queue-utils';
import { getSearchedTermSets } from './lib/searched-terms';

const MAX_CONSECUTIVE_ZEROS = 3;
const BATCH_SIZE = 5; // enqueue 5 at a time for faster throughput

async function getPropertyCount(): Promise<number> {
  return prisma.property.count({ where: { year: config.scraper.tcadYear } });
}

async function main() {
  // Generate the prefix expansion terms (tier 3 from generate-next-200-terms)
  const analytics = await prisma.searchTermAnalytics.findMany({
    where: {
      avgResultsPerSearch: { gte: 500 },
      successRate: { gte: 0.5 },
      termLength: { lte: 5 },
    },
    orderBy: { avgResultsPerSearch: 'desc' },
    select: { searchTerm: true, avgResultsPerSearch: true },
  });

  // Load already-searched terms
  const { allSearched: searched } = await getSearchedTermSets();

  // Load blacklist
  const blacklisted = await prisma.searchTermAnalytics.findMany({
    where: { successRate: 0, totalSearches: { gte: 3 } },
    select: { searchTerm: true },
  });
  const blacklistSet = new Set(blacklisted.map(b => b.searchTerm.toLowerCase()));

  // Generate all prefix expansion terms
  const expansions: string[] = [];
  const seen = new Set<string>();
  for (const base of analytics) {
    for (let c = 97; c <= 122; c++) {
      const term = base.searchTerm + String.fromCharCode(c);
      const lower = term.toLowerCase();
      if (searched.has(lower) || blacklistSet.has(lower) || seen.has(lower)) continue;
      if (term.length < 4) continue;
      expansions.push(term);
      seen.add(lower);
    }
  }

  console.log(`Generated ${expansions.length} prefix expansion terms`);
  console.log(`Max consecutive zeros before stop: ${MAX_CONSECUTIVE_ZEROS}`);
  console.log(`Batch size: ${BATCH_SIZE}\n`);

  let consecutiveZeros = 0;
  let totalEnqueued = 0;
  let totalNewProps = 0;
  let idx = 0;

  while (idx < expansions.length) {
    // Take next batch
    const batch = expansions.slice(idx, idx + BATCH_SIZE);
    idx += batch.length;

    const beforeCount = await getPropertyCount();

    // Enqueue batch
    const enqueued = await enqueueBatch(batch, 'prefix-expansion');
    console.log(`Enqueued batch ${Math.ceil(idx / BATCH_SIZE)}: ${batch.join(', ')}`);
    totalEnqueued += enqueued;

    // Wait for batch to complete
    await waitForQueueDrain();

    const afterCount = await getPropertyCount();
    const newProps = afterCount - beforeCount;
    totalNewProps += newProps;

    if (newProps === 0) {
      consecutiveZeros++;
      console.log(`  -> 0 new properties (${consecutiveZeros}/${MAX_CONSECUTIVE_ZEROS} consecutive zeros)`);
    } else {
      consecutiveZeros = 0;
      console.log(`  -> +${newProps} new properties (total DB: ${afterCount.toLocaleString()})`);
    }

    if (consecutiveZeros >= MAX_CONSECUTIVE_ZEROS) {
      console.log(`\nSTOPPING: ${MAX_CONSECUTIVE_ZEROS} consecutive batches with 0 new properties`);
      break;
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Terms enqueued: ${totalEnqueued}`);
  console.log(`Terms remaining: ${expansions.length - idx}`);
  console.log(`New properties added: ${totalNewProps}`);
  console.log(`Final DB count: ${(await getPropertyCount()).toLocaleString()}`);

  await scraperQueue.close();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
