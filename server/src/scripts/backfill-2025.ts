/**
 * Backfill 2025 TCAD properties by enqueuing high-yield terms
 * that exist in 2026 data but not yet in 2025.
 *
 * Usage: TCAD_YEAR=2025 doppler run -- npx tsx src/scripts/backfill-2025.ts
 */

import { prisma } from "../lib/prisma";
import { scraperQueue } from "../queues/scraper.queue";
import { config } from "../config";
import { getErrorMessage } from "../utils/error-helpers";
import {
  DENSE_MAX_RESULTS_THRESHOLD, DENSE_AVG_RESULTS_THRESHOLD,
  DENSE_MIN_SUCCESS_RATE, DENSE_MAX_BASE_LENGTH,
  SEED_MIN_SUCCESS_RATE, SEED_MIN_AVG_RESULTS,
  RECENT_JOBS_LOOKBACK_MS, MIN_TERM_LENGTH, ALPHABET,
} from "./lib/backfill-constants";

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

async function getSearchedTerms(): Promise<{ searched2025: Set<string>; allSearched: Set<string>; successful: Set<string> }> {
  // Already-scraped 2025 search terms
  const terms2025 = await prisma.$queryRaw<Array<{ search_term: string }>>`
    SELECT DISTINCT search_term FROM properties WHERE year = 2025`;
  const searched2025 = new Set(terms2025.map(r => r.search_term.toLowerCase()));

  // Also check scrape_jobs that ran recently (even if 0 results)
  const recentJobs = await prisma.scrapeJob.findMany({
    where: { startedAt: { gte: new Date(Date.now() - RECENT_JOBS_LOOKBACK_MS) } },
    select: { searchTerm: true },
  });
  for (const j of recentJobs) searched2025.add(j.searchTerm.toLowerCase());

  // All analytics terms (for superset checking)
  const analyticsRows = await prisma.searchTermAnalytics.findMany({
    select: { searchTerm: true, totalResults: true },
  });
  const allSearched = new Set<string>();
  const successful = new Set<string>();
  for (const r of analyticsRows) {
    const lower = r.searchTerm.toLowerCase();
    allSearched.add(lower);
    if (r.totalResults > 0) successful.add(lower);
  }

  return { searched2025, allSearched, successful };
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

async function getDenseExpansions(allSearched: Set<string>): Promise<string[]> {
  const dense = await prisma.searchTermAnalytics.findMany({
    where: {
      OR: [
        { maxResults: { gte: DENSE_MAX_RESULTS_THRESHOLD } },
        { avgResultsPerSearch: { gte: DENSE_AVG_RESULTS_THRESHOLD } },
      ],
      successRate: { gte: DENSE_MIN_SUCCESS_RATE },
    },
    orderBy: { avgResultsPerSearch: "desc" },
    select: { searchTerm: true },
  });

  const expansions: string[] = [];
  const seen = new Set<string>();
  for (const row of dense) {
    if (row.searchTerm.length > DENSE_MAX_BASE_LENGTH) continue;
    for (const ch of ALPHABET) {
      const expanded = row.searchTerm + ch;
      const lower = expanded.toLowerCase();
      if (expanded.length < MIN_TERM_LENGTH || allSearched.has(lower) || seen.has(lower)) continue;
      seen.add(lower);
      expansions.push(expanded);
    }
  }
  return expansions;
}

async function getSeedExpansions(allSearched: Set<string>): Promise<string[]> {
  const highYield = await prisma.searchTermAnalytics.findMany({
    where: { successRate: { gte: SEED_MIN_SUCCESS_RATE }, avgResultsPerSearch: { gte: SEED_MIN_AVG_RESULTS } },
    orderBy: { avgResultsPerSearch: "desc" },
    select: { searchTerm: true },
  });

  const prefixes = new Set<string>();
  for (const row of highYield) {
    if (row.searchTerm.length >= MIN_TERM_LENGTH) {
      prefixes.add(row.searchTerm.substring(0, MIN_TERM_LENGTH).toLowerCase());
    }
  }

  const expansions: string[] = [];
  const seen = new Set<string>();
  for (const prefix of prefixes) {
    for (const ch of ALPHABET) {
      const expanded = prefix + ch;
      if (allSearched.has(expanded) || seen.has(expanded)) continue;
      seen.add(expanded);
      expansions.push(expanded);
    }
  }
  return expansions;
}

// Static high-yield terms (full names/neighborhoods, 5-12 chars, avoid API truncation)
const STATIC_TERMS = [
  // First names (unsearched from memory/search-term-candidates.md + generate-search-terms.ts)
  "Michael", "Christopher", "Paul", "Patrick", "Jerry", "Tyler", "Aaron", "Peter",
  "Nathan", "Arthur", "Roger", "Eugene", "Roy", "Ralph", "Randy", "Jennifer",
  "Jessica", "Amanda", "Melissa", "Michelle", "Stephanie", "Nicole", "Angela",
  "Christina", "Samantha", "Katherine", "Christine", "Deborah", "Rachel", "Laura",
  "Carolyn", "Janet", "Catherine", "Frances", "Joyce", "Diane", "Alice", "Julie",
  "Heather", "Teresa", "Gloria", "Evelyn", "Cheryl", "Mildred", "Martha", "Donna",
  "Dorothy", "Sharon", "Betty", "Helen", "Sandra", "Kimberly", "Emily", "Brenda",
  "Amy", "Anna", "Rebecca", "Virginia", "Pamela", "Cynthia", "Ruth", "Kathleen",
  "Linda", "Nancy", "Karen", "Margaret", "Marie", "Frank", "Raymond", "Jack",
  "Dennis", "Henry", "Douglas", "Gerald", "Lawrence", "Bruce", "Russell", "Louis",
  "Philip", "Johnny", "Harry", "Vincent", "Billy", "Howard", "Carl", "Terry",
  "Sean", "Austin", "Jesse", "Ethan", "Dylan", "Bryan", "Jordan", "Miguel",
  "Carlos", "Rafael", "Angel", "Oscar", "Fernando", "Manuel", "Ricardo", "Roberto",
  "Eduardo", "Pedro", "Alejandro", "Sergio",
  // Last names
  "Jenkins", "Perry", "Powell", "Patterson", "Hughes", "Washington", "Butler",
  "Simmons", "Foster", "Gonzales", "Bryant", "Alexander", "Russell", "Griffin",
  "Hayes", "Myers", "Ford", "Hamilton", "Graham", "Sullivan", "Wallace", "Woods",
  "Cole", "West", "Owens", "Reynolds", "Fisher", "Ellis", "Harrison", "Gibson",
  "McDonald", "Marshall", "Ortega", "Burns", "Kelley", "Dunn", "Crawford",
  "Vasquez", "Dean", "Lane", "Soto", "Lynch", "Stone", "Dixon", "Hicks", "Weaver",
  "Hart", "Hunt", "Palmer", "Robertson", "Holmes", "Spencer", "Francis", "Stephens",
  "Vargas", "Herrera", "Medina", "Aguilar", "Salazar", "Delgado", "Vega", "Rios",
  "Romero", "Guerrero", "Castro", "Estrada", "Contreras", "Fuentes", "Leon",
  "Acosta", "Maldonado", "Rosales", "Barnes", "Coleman", "Cox", "Ward",
  // Geo/street/neighborhood
  "Slaughter", "Lamar", "Manchaca", "Round Rock", "Cedar Park", "Pflugerville",
  "Lakeway", "Woodland", "Greenwood", "Sunset", "Wells Branch", "Ben White",
  "Dessau", "Steiner", "Avery", "Circle C", "Dripping Springs", "Onion Creek",
  "Shady Hollow", "Travis Country", "Barton Creek", "Westover", "Bryker Woods",
  "North Loop", "South Congress", "East Riverside", "South Lamar", "North Austin",
  "Bee Cave", "Lakeline", "Brushy Creek", "Leander", "Highland", "Clarksville",
  "Old West Austin", "Bouldin Creek", "Travis Heights", "South Austin",
  "North Lamar", "East Austin", "Anderson Mill", "Braker", "Rundberg", "Oltorf",
  "Stassney", "William Cannon", "Buda",
  // Entity/business
  "Ventures", "Services", "Solutions", "International", "National", "Resources",
  "Global", "Enterprises", "Partners", "Advisors", "Consulting", "Management",
  "Alliance", "Network", "Labs", "Studio", "Works", "Builders", "Communities",
  "Rentals", "Housing", "Leasing", "Mortgage",
  // Geo features
  "Bend", "Trace", "Crossing", "Circle", "Court", "Place", "Hollow", "Branch",
  "Pass", "Point", "Island", "Terrace", "Stone", "Cedar", "Pine", "Cypress",
  "Willow", "Birch", "Holly", "Sage", "Laurel", "Magnolia", "Pecan", "Mesquite",
  "Live Oak", "Post Oak", "Oaks", "Pines", "Hills", "Springs", "Falls", "Shores",
  "Estates", "Landing", "Overlook", "Retreat", "Haven", "Commons", "Gardens",
  "Heights", "Pointe",
];

async function getTermsToBackfill(): Promise<string[]> {
  const { searched2025, allSearched, successful } = await getSearchedTerms();

  // Source 1: High-yield 2026 terms not yet in 2025
  const terms2026 = await prisma.$queryRaw<Array<{ search_term: string; cnt: number }>>`
    SELECT search_term, COUNT(*)::int as cnt
    FROM properties
    WHERE year = 2026
    GROUP BY search_term
    ORDER BY cnt DESC
    LIMIT 300`;

  // Source 2: High-yield analytics terms
  const analytics = await prisma.searchTermAnalytics.findMany({
    where: { totalResults: { gt: 500 } },
    orderBy: { totalResults: "desc" },
    select: { searchTerm: true, totalResults: true },
  });

  // Source 3: Dense term prefix expansions
  const denseExpansions = await getDenseExpansions(allSearched);

  // Source 4: Analytics seed prefix expansions
  const seedExpansions = await getSeedExpansions(allSearched);

  const seen = new Set<string>();
  const result: string[] = [];

  function addTerm(term: string): void {
    const lower = term.toLowerCase();
    if (searched2025.has(lower) || seen.has(lower)) return;
    if (term.length < MIN_TERM_LENGTH) return;
    if (isSupersetOfSuccessful(lower, successful)) return;
    seen.add(lower);
    result.push(term);
  }

  // Priority: proven 2026 > analytics > STATIC FULL TERMS > dense > seed expansions
  for (const r of terms2026) addTerm(r.search_term);
  for (const r of analytics) addTerm(r.searchTerm);
  console.log(`  Known high-yield terms: ${result.length}`);
  for (const t of STATIC_TERMS) addTerm(t);
  console.log(`  After static terms: ${result.length}`);
  for (const t of denseExpansions) addTerm(t);
  console.log(`  After dense expansions: ${result.length}`);
  for (const t of seedExpansions) addTerm(t);
  console.log(`  After seed expansions: ${result.length}`);

  return result;
}

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
        { searchTerm: term, userId: "backfill-2025", scheduled: true },
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
    console.error("Run with: TCAD_YEAR=2025 doppler run -- npx tsx src/scripts/backfill-2025.ts");
    process.exit(1);
  }

  let current = await get2025Count();
  console.log(`\n=== 2025 Backfill ===`);
  console.log(`Current 2025 properties: ${current.toLocaleString()}`);
  console.log(`Target: ${TARGET_2025_COUNT.toLocaleString()}`);
  console.log(`Gap: ${(TARGET_2025_COUNT - current).toLocaleString()}\n`);

  if (current >= TARGET_2025_COUNT) {
    console.log("Already at target.");
    return;
  }

  const allTerms = await getTermsToBackfill();
  console.log(`Terms to backfill: ${allTerms.length}\n`);

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
