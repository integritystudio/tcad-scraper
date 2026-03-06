/**
 * Backfill 2025 TCAD properties using unsearched name/address patterns
 * mined from 2026-only properties (property_ids in 2026 but not 2025).
 *
 * Strategy: extract owner names, entity names, and street names from
 * 2026 properties that have no 2025 counterpart, filter supersets and
 * already-searched terms, then enqueue in batches with drain-and-count.
 *
 * Usage: TCAD_YEAR=2025 doppler run -- npx tsx src/scripts/backfill-2025-unsearched.ts
 */

import { prisma } from "../lib/prisma";
import { scraperQueue } from "../queues/scraper.queue";
import { config } from "../config";
import { getErrorMessage } from "../utils/error-helpers";
import { RECENT_JOBS_LOOKBACK_MS, MIN_TERM_LENGTH } from "./lib/backfill-constants";

const TARGET_2025_COUNT = 420_000;
const BATCH_SIZE = 20;
const POLL_INTERVAL_MS = 15_000;
const MAX_CONSECUTIVE_ZERO_BATCHES = 3;

async function get2025Count(): Promise<number> {
  // ::int cast required: Prisma $queryRaw returns BigInt for COUNT(*); cast to int before JS receives it.
  // If this cast is removed, the `number` type annotation will silently lie (BigInt !== number).
  const result = await prisma.$queryRaw<[{ count: number }]>`
    SELECT COUNT(*)::int as count FROM properties WHERE year = 2025`;
  return result[0].count;
}

interface TermSets {
  searched: Set<string>;
  successful: Set<string>;
  searched2025: Set<string>;
}

async function getTermSets(): Promise<TermSets> {
  const analyticsRows = await prisma.searchTermAnalytics.findMany({
    select: { searchTerm: true, totalResults: true },
  });
  const searched = new Set<string>();
  const successful = new Set<string>();
  for (const r of analyticsRows) {
    const lower = r.searchTerm.toLowerCase();
    searched.add(lower);
    if (r.totalResults > 0) successful.add(lower);
  }

  const terms2025 = await prisma.$queryRaw<Array<{ search_term: string }>>`
    SELECT DISTINCT search_term FROM properties WHERE year = 2025`;
  const searched2025 = new Set(terms2025.map(r => r.search_term.toLowerCase()));

  // Include recent scrape jobs to avoid re-running
  const recentJobs = await prisma.scrapeJob.findMany({
    where: { startedAt: { gte: new Date(Date.now() - RECENT_JOBS_LOOKBACK_MS) } },
    select: { searchTerm: true },
  });
  for (const j of recentJobs) {
    searched2025.add(j.searchTerm.toLowerCase());
    searched.add(j.searchTerm.toLowerCase());
  }

  return { searched, successful, searched2025 };
}

// Extension filter: skip candidates that extend an already-successful shorter term.
// Example: skip "JOHNSONVIL" if "JOHNSON" yielded results — the TCAD full-text search
// returns all properties matching the shorter prefix, so it already captured this set.
// Contrast with backfill-2025-novel.ts which uses the OPPOSITE strategy: skip terms
// that are themselves prefixes of longer already-searched terms.
function isSupersetOfSuccessful(lower: string, successful: Set<string>): boolean {
  for (let len = MIN_TERM_LENGTH; len < lower.length; len++) {
    if (successful.has(lower.substring(0, len))) return true;
  }
  return false;
}

async function getUnsearchedTerms(): Promise<string[]> {
  const { searched, successful, searched2025 } = await getTermSets();
  const seen = new Set<string>();
  const result: string[] = [];
  let skippedSupersets = 0;
  let skippedSearched = 0;

  function addTerm(term: string): boolean {
    if (term.length < MIN_TERM_LENGTH) return false;
    const lower = term.toLowerCase();
    if (searched.has(lower) || searched2025.has(lower) || seen.has(lower)) {
      skippedSearched++;
      return false;
    }
    if (isSupersetOfSuccessful(lower, successful)) {
      skippedSupersets++;
      return false;
    }
    seen.add(lower);
    result.push(term);
    return true;
  }

  // ── Source 1: Owner first-words from 2026-only properties ──────────
  console.log("  Mining owner first-words from 2026-only properties...");
  const firstWords = await prisma.$queryRaw<Array<{ word: string; cnt: number }>>`
    SELECT SPLIT_PART(p.name, ' ', 1) as word, COUNT(DISTINCT p.property_id)::int as cnt
    FROM properties p
    WHERE p.year = 2026
    AND p.property_id NOT IN (SELECT property_id FROM properties WHERE year = 2025)
    AND LENGTH(SPLIT_PART(p.name, ' ', 1)) >= ${MIN_TERM_LENGTH}
    GROUP BY SPLIT_PART(p.name, ' ', 1)
    HAVING COUNT(DISTINCT p.property_id) >= 5
    ORDER BY cnt DESC`;
  for (const w of firstWords) addTerm(w.word);
  console.log(`    First-words added: ${result.length}`);

  // ── Source 2: Entity two-word phrases ──────────────────────────────
  const prevCount = result.length;
  console.log("  Mining entity two-word phrases...");
  const twoWords = await prisma.$queryRaw<Array<{ phrase: string; cnt: number }>>`
    SELECT CONCAT(SPLIT_PART(p.name, ' ', 1), ' ', SPLIT_PART(p.name, ' ', 2)) as phrase,
           COUNT(DISTINCT p.property_id)::int as cnt
    FROM properties p
    WHERE p.year = 2026
    AND p.property_id NOT IN (SELECT property_id FROM properties WHERE year = 2025)
    AND (p.name LIKE '%LLC%' OR p.name LIKE '%INC%' OR p.name LIKE '%LP%'
         OR p.name LIKE '%LTD%' OR p.name LIKE '%TRUST%')
    GROUP BY phrase
    HAVING COUNT(DISTINCT p.property_id) >= 10
    ORDER BY cnt DESC`;
  for (const t of twoWords) addTerm(t.phrase);
  console.log(`    Entity phrases added: ${result.length - prevCount}`);

  // ── Source 3: Street names from 2026-only properties ───────────────
  const prevCount2 = result.length;
  console.log("  Mining street names...");
  const streets = await prisma.$queryRaw<Array<{ street: string; cnt: number }>>`
    SELECT SPLIT_PART(property_address, ' ', 2) as street,
           COUNT(DISTINCT property_id)::int as cnt
    FROM properties
    WHERE year = 2026
    AND property_id NOT IN (SELECT property_id FROM properties WHERE year = 2025)
    AND property_address IS NOT NULL
    AND LENGTH(SPLIT_PART(property_address, ' ', 2)) >= ${MIN_TERM_LENGTH}
    GROUP BY SPLIT_PART(property_address, ' ', 2)
    HAVING COUNT(DISTINCT property_id) >= 5
    ORDER BY cnt DESC`;
  for (const s of streets) addTerm(s.street);
  console.log(`    Street names added: ${result.length - prevCount2}`);

  // ── Source 4: Full owner names (first + second word) for all 2026-only ─
  const prevCount3 = result.length;
  console.log("  Mining full owner names (two-word, non-entity)...");
  const fullNames = await prisma.$queryRaw<Array<{ phrase: string; cnt: number }>>`
    SELECT CONCAT(SPLIT_PART(p.name, ' ', 1), ' ', SPLIT_PART(p.name, ' ', 2)) as phrase,
           COUNT(DISTINCT p.property_id)::int as cnt
    FROM properties p
    WHERE p.year = 2026
    AND p.property_id NOT IN (SELECT property_id FROM properties WHERE year = 2025)
    AND LENGTH(SPLIT_PART(p.name, ' ', 1)) >= ${MIN_TERM_LENGTH}
    AND LENGTH(SPLIT_PART(p.name, ' ', 2)) >= 2
    GROUP BY phrase
    HAVING COUNT(DISTINCT p.property_id) >= 5
    ORDER BY cnt DESC`;
  for (const n of fullNames) addTerm(n.phrase);
  console.log(`    Full names added: ${result.length - prevCount3}`);

  // ── Source 5: Description first-words from 2026-only properties ────
  const prevCount4 = result.length;
  console.log("  Mining description keywords...");
  const descriptions = await prisma.$queryRaw<Array<{ word: string; cnt: number }>>`
    SELECT SPLIT_PART(p.description, ' ', 1) as word, COUNT(DISTINCT p.property_id)::int as cnt
    FROM properties p
    WHERE p.year = 2026
    AND p.property_id NOT IN (SELECT property_id FROM properties WHERE year = 2025)
    AND p.description IS NOT NULL
    AND LENGTH(SPLIT_PART(p.description, ' ', 1)) >= ${MIN_TERM_LENGTH}
    GROUP BY SPLIT_PART(p.description, ' ', 1)
    HAVING COUNT(DISTINCT p.property_id) >= 10
    ORDER BY cnt DESC`;
  for (const d of descriptions) addTerm(d.word);
  console.log(`    Description keywords added: ${result.length - prevCount4}`);

  console.log(`\n  Summary: ${result.length} terms | skipped ${skippedSearched} already-searched, ${skippedSupersets} supersets`);
  return result;
}

// No timeout: polls until queue is fully drained. A permanently stalled BullMQ job
// will block indefinitely. Acceptable for CLI use — Ctrl+C to abort if needed.
async function waitForQueueDrain(): Promise<void> {
  let waiting = await scraperQueue.getWaitingCount();
  let active = await scraperQueue.getActiveCount();
  while (waiting > 0 || active > 0) {
    process.stdout.write(`\r  Queue: ${active} active, ${waiting} waiting...   `);
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    waiting = await scraperQueue.getWaitingCount();
    active = await scraperQueue.getActiveCount();
  }
  process.stdout.write("\r  Queue drained.                          \n");
}

async function enqueueBatch(terms: string[]): Promise<number> {
  const { jobName, defaultJobOptions } = config.queue;
  let enqueued = 0;
  for (const term of terms) {
    try {
      await scraperQueue.add(
        jobName,
        { searchTerm: term, userId: "backfill-2025-unsearched", scheduled: true },
        {
          attempts: defaultJobOptions.attempts,
          backoff: { type: "exponential", delay: defaultJobOptions.backoffDelay },
          removeOnComplete: defaultJobOptions.removeOnComplete,
          removeOnFail: defaultJobOptions.removeOnFail,
        },
      );
      enqueued++;
    } catch (error) {
      console.error(`  Failed to enqueue "${term}": ${getErrorMessage(error)}`);
    }
  }
  return enqueued;
}

async function main() {
  if (config.scraper.tcadYear !== 2025) {
    console.error(`ERROR: TCAD_YEAR is ${config.scraper.tcadYear}, must be 2025.`);
    console.error("Run with: TCAD_YEAR=2025 doppler run -- npx tsx src/scripts/backfill-2025-unsearched.ts");
    process.exit(1);
  }

  let current = await get2025Count();
  console.log(`\n=== 2025 Backfill (Unsearched Patterns) ===`);
  console.log(`Current 2025 properties: ${current.toLocaleString()}`);
  console.log(`Target: ${TARGET_2025_COUNT.toLocaleString()}`);
  console.log(`Gap: ${(TARGET_2025_COUNT - current).toLocaleString()}\n`);

  if (current >= TARGET_2025_COUNT) {
    console.log("Already at target.");
    return;
  }

  const allTerms = await getUnsearchedTerms();
  console.log(`\nTerms to backfill: ${allTerms.length}\n`);

  if (allTerms.length === 0) {
    console.log("No unsearched terms found.");
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

    const enqueued = await enqueueBatch(batch);
    console.log(`  Enqueued: ${enqueued}`);

    await waitForQueueDrain();

    const newCount = await get2025Count();
    const gained = newCount - current;
    totalGained += gained;
    console.log(`  2025 properties: ${newCount.toLocaleString()} (+${gained.toLocaleString()}) [session: +${totalGained.toLocaleString()}]`);
    console.log(`  Remaining: ${Math.max(0, TARGET_2025_COUNT - newCount).toLocaleString()}`);

    if (gained === 0) {
      consecutiveZeroBatches++;
      console.log(`  Zero-result batches in a row: ${consecutiveZeroBatches}/${MAX_CONSECUTIVE_ZERO_BATCHES}`);
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
