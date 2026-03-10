/**
 * Backfill 2025 TCAD properties using NOVEL terms mined from 2026-only
 * properties — owner names that have NEVER been searched before.
 *
 * These are terms like NGUYEN, MARTINEZ, HERNANDEZ etc. that appear on
 * 2026 properties with no 2025 counterpart and haven't been used as
 * search terms in any prior scrape.
 *
 * Usage: TCAD_YEAR=2025 doppler run -- npx tsx src/scripts/backfill-2025-novel.ts
 */

import { prisma } from "../lib/prisma";
import { scraperQueue } from "../queues/scraper.queue";
import { config } from "../config";
import { getErrorMessage } from "../utils/error-helpers";
import { RECENT_JOBS_LOOKBACK_MS, MIN_TERM_LENGTH, TARGET_2025_PROPERTY_COUNT as TARGET_2025_COUNT } from "./lib/backfill-constants";
import { enqueueBatch, waitForQueueDrain, BATCH_SIZE } from "./lib/queue-utils";
import { get2025Count } from "./lib/backfill-utils";
const MAX_CONSECUTIVE_ZERO_BATCHES = 5;
const MIN_PROPS_PER_TERM = 10;

async function getSearchedTerms(): Promise<Set<string>> {
  // All terms ever used: 2025 properties + 2026 properties + scrape_jobs
  const [terms25, terms26, jobs] = await Promise.all([
    prisma.$queryRaw<Array<{ search_term: string }>>`
      SELECT DISTINCT search_term FROM properties WHERE year = 2025`,
    prisma.$queryRaw<Array<{ search_term: string }>>`
      SELECT DISTINCT search_term FROM properties WHERE year = 2026`,
    prisma.scrapeJob.findMany({
      where: { startedAt: { gte: new Date(Date.now() - RECENT_JOBS_LOOKBACK_MS) } },
      select: { searchTerm: true },
    }),
  ]);

  const searched = new Set<string>();
  for (const r of terms25) searched.add(r.search_term.toLowerCase());
  for (const r of terms26) searched.add(r.search_term.toLowerCase());
  for (const j of jobs) searched.add(j.searchTerm.toLowerCase());

  // Also include analytics terms
  const analytics = await prisma.searchTermAnalytics.findMany({
    select: { searchTerm: true },
  });
  for (const a of analytics) searched.add(a.searchTerm.toLowerCase());

  return searched;
}

// Prefix filter (opposite strategy from other backfill scripts):
// Skip novel candidates that are already a prefix of a longer already-searched term.
// Example: skip "FORT" if "FORTENBERRY" was already searched — the novel-terms goal
// is to mine genuinely new owner name namespaces, not extend already-explored ones.
// Contrast with backfill-2025.ts / backfill-2025-unsearched.ts which use the OPPOSITE
// strategy: skip candidates that EXTEND (are supersets of) successful shorter terms.
function buildPrefixIndex(searched: Set<string>): Set<string> {
  const prefixes = new Set<string>();
  for (const term of searched) {
    for (let len = MIN_TERM_LENGTH; len < term.length; len++) {
      prefixes.add(term.substring(0, len));
    }
  }
  return prefixes;
}

interface CandidateTerm {
  term: string;
  yield: number;
  source: string;
}

async function getNovelTerms(): Promise<string[]> {
  const searched = await getSearchedTerms();
  console.log(`  Already-searched terms: ${searched.size}`);

  // Collect all candidates with their yields from all sources
  const candidates: CandidateTerm[] = [];

  // ── Source 1: Owner first-words from 2026-only properties ──────────
  console.log("  Mining owner first-words from 2026-only properties...");
  const firstWords = await prisma.$queryRaw<Array<{ word: string; cnt: number }>>`
    SELECT SPLIT_PART(p.name, ' ', 1) as word, COUNT(DISTINCT p.property_id)::int as cnt
    FROM properties p
    WHERE p.year = 2026
    AND p.property_id NOT IN (SELECT property_id FROM properties WHERE year = 2025)
    AND LENGTH(SPLIT_PART(p.name, ' ', 1)) >= ${MIN_TERM_LENGTH}
    AND SPLIT_PART(p.name, ' ', 1) ~ '^[A-Za-z]'
    GROUP BY SPLIT_PART(p.name, ' ', 1)
    HAVING COUNT(DISTINCT p.property_id) >= ${MIN_PROPS_PER_TERM}
    ORDER BY cnt DESC`;
  for (const w of firstWords) candidates.push({ term: w.word, yield: w.cnt, source: "owner" });
  console.log(`    First-words mined: ${firstWords.length}`);

  // ── Source 2: Street names from 2026-only properties ───────────────
  console.log("  Mining street names from 2026-only properties...");
  const streets = await prisma.$queryRaw<Array<{ street: string; cnt: number }>>`
    SELECT SPLIT_PART(property_address, ' ', 2) as street,
           COUNT(DISTINCT property_id)::int as cnt
    FROM properties
    WHERE year = 2026
    AND property_id NOT IN (SELECT property_id FROM properties WHERE year = 2025)
    AND property_address IS NOT NULL
    AND LENGTH(SPLIT_PART(property_address, ' ', 2)) >= ${MIN_TERM_LENGTH}
    AND SPLIT_PART(property_address, ' ', 2) ~ '^[A-Za-z]'
    GROUP BY SPLIT_PART(property_address, ' ', 2)
    HAVING COUNT(DISTINCT property_id) >= ${MIN_PROPS_PER_TERM}
    ORDER BY cnt DESC`;
  for (const s of streets) candidates.push({ term: s.street, yield: s.cnt, source: "street" });
  console.log(`    Street names mined: ${streets.length}`);

  // ── Source 3: Description first-words from 2026-only properties ────
  console.log("  Mining description keywords...");
  const descs = await prisma.$queryRaw<Array<{ word: string; cnt: number }>>`
    SELECT SPLIT_PART(p.description, ' ', 1) as word, COUNT(DISTINCT p.property_id)::int as cnt
    FROM properties p
    WHERE p.year = 2026
    AND p.property_id NOT IN (SELECT property_id FROM properties WHERE year = 2025)
    AND p.description IS NOT NULL
    AND LENGTH(SPLIT_PART(p.description, ' ', 1)) >= ${MIN_TERM_LENGTH}
    AND SPLIT_PART(p.description, ' ', 1) ~ '^[A-Za-z]'
    GROUP BY SPLIT_PART(p.description, ' ', 1)
    HAVING COUNT(DISTINCT p.property_id) >= ${MIN_PROPS_PER_TERM}
    ORDER BY cnt DESC`;
  for (const d of descs) candidates.push({ term: d.word, yield: d.cnt, source: "desc" });
  console.log(`    Description keywords mined: ${descs.length}`);

  // ── Source 4: Two-word owner names from 2026-only properties ───────
  console.log("  Mining two-word owner names...");
  const twoWords = await prisma.$queryRaw<Array<{ phrase: string; cnt: number }>>`
    SELECT CONCAT(SPLIT_PART(p.name, ' ', 1), ' ', SPLIT_PART(p.name, ' ', 2)) as phrase,
           COUNT(DISTINCT p.property_id)::int as cnt
    FROM properties p
    WHERE p.year = 2026
    AND p.property_id NOT IN (SELECT property_id FROM properties WHERE year = 2025)
    AND LENGTH(SPLIT_PART(p.name, ' ', 1)) >= ${MIN_TERM_LENGTH}
    AND LENGTH(SPLIT_PART(p.name, ' ', 2)) >= 2
    AND SPLIT_PART(p.name, ' ', 1) ~ '^[A-Za-z]'
    GROUP BY phrase
    HAVING COUNT(DISTINCT p.property_id) >= ${MIN_PROPS_PER_TERM}
    ORDER BY cnt DESC`;
  for (const t of twoWords) candidates.push({ term: t.phrase, yield: t.cnt, source: "two-word" });
  console.log(`    Two-word names mined: ${twoWords.length}`);

  // ── Sort all candidates globally by yield DESC ─────────────────────
  candidates.sort((a, b) => b.yield - a.yield);
  console.log(`\n  Total candidates mined: ${candidates.length}`);

  // ── Build prefix index for O(1) "is this a prefix of something searched?" ─
  const searchedPrefixes = buildPrefixIndex(searched);

  // ── Dedupe and filter ──────────────────────────────────────────────
  const seen = new Set<string>();
  const result: string[] = [];
  let skippedSearched = 0;
  let skippedPrefix = 0;
  let skippedDupe = 0;

  for (const c of candidates) {
    const lower = c.term.toLowerCase().trim();
    if (lower.length < MIN_TERM_LENGTH) continue;
    if (seen.has(lower)) { skippedDupe++; continue; }
    if (searched.has(lower)) { skippedSearched++; continue; }
    // Skip if this term is a prefix of an already-searched longer term
    // e.g. "fort" skipped because "fortenberry" was already searched
    if (searchedPrefixes.has(lower)) { skippedPrefix++; continue; }
    seen.add(lower);
    result.push(c.term);
  }

  console.log(`  Skipped: ${skippedSearched} already-searched, ${skippedPrefix} prefix-of-searched, ${skippedDupe} dupes`);
  console.log(`  Final novel terms: ${result.length}`);
  return result;
}

async function main() {
  if (config.scraper.tcadYear !== 2025) {
    console.error(`ERROR: TCAD_YEAR is ${config.scraper.tcadYear}, must be 2025.`);
    console.error("Run with: TCAD_YEAR=2025 doppler run -- npx tsx src/scripts/backfill-2025-novel.ts");
    process.exit(1);
  }

  let current = await get2025Count();
  console.log(`\n=== 2025 Backfill (Novel Owner Names) ===`);
  console.log(`Current 2025 properties: ${current.toLocaleString()}`);
  console.log(`Target: ${TARGET_2025_COUNT.toLocaleString()}`);
  console.log(`Gap: ${(TARGET_2025_COUNT - current).toLocaleString()}\n`);

  if (current >= TARGET_2025_COUNT) {
    console.log("Already at target.");
    return;
  }

  const allTerms = await getNovelTerms();
  console.log(`\nTerms to backfill: ${allTerms.length}\n`);

  if (allTerms.length === 0) {
    console.log("No novel terms found.");
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

    const enqueued = await enqueueBatch(batch, "backfill-2025-novel");
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
