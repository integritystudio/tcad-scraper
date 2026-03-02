/**
 * Generate search terms using adaptive prefix expansion driven by analytics.
 *
 * Tiered generation:
 *   1. Dense term expansions (split high-result terms by appending a-z)
 *   2. Analytics seed expansions (high-yield 4-char prefixes + a-z)
 *   3. Unexplored prefix candidates (gap analysis on searched prefixes)
 *   4. Static fallback arrays (legacy names/geo/entity/neighborhood)
 *
 * Usage: doppler run -- npx tsx src/scripts/generate-search-terms.ts
 * Flags:
 *   --enqueue   also enqueue the generated terms into BullMQ
 *   --json      output JSON instead of TypeScript
 *   --limit N   number of terms to generate (default: 200)
 */

import { prisma } from "../lib/prisma";
import { scraperQueue } from "../queues/scraper.queue";
import { getErrorMessage } from "../utils/error-helpers";

const TARGET_TERM_COUNT = parseInt(
  process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ??
    (process.argv.includes("--limit")
      ? process.argv[process.argv.indexOf("--limit") + 1]
      : "200"),
  10,
);
const SHOULD_ENQUEUE = process.argv.includes("--enqueue");
const OUTPUT_JSON = process.argv.includes("--json");

// ── Thresholds (from plan) ───────────────────────────────────────────
const DENSE_MAX_RESULTS_THRESHOLD = 5000;
const DENSE_AVG_RESULTS_THRESHOLD = 2000;
const SEED_MIN_SUCCESS_RATE = 0.5;
const SEED_MIN_AVG_RESULTS = 100;
const MIN_TERM_LENGTH = 4;
const ALPHABET = "abcdefghijklmnopqrstuvwxyz";

// ── Static fallback arrays (tier 4) ─────────────────────────────────

const FIRST_NAMES = [
  "Michael", "William", "Christopher", "Jose", "Paul", "Frank",
  "Raymond", "Jack", "Dennis", "Jerry", "Tyler", "Aaron",
  "Henry", "Douglas", "Peter", "Nathan", "Zachary", "Arthur",
  "Albert", "Gerald", "Lawrence", "Roger", "Bruce", "Eugene",
  "Russell", "Louis", "Philip", "Roy", "Ralph", "Randy",
  "Johnny", "Harry", "Vincent", "Billy", "Howard",
  "Carl", "Terry", "Sean", "Austin", "Jesse", "Ethan",
  "Dylan", "Bryan", "Joe", "Jordan", "Ray", "Miguel",
  "Carlos", "Rafael", "Angel", "Oscar", "Fernando", "Manuel",
  "Ricardo", "Roberto", "Eduardo", "Pedro", "Alejandro", "Sergio",
  "Jennifer", "Jessica", "Amanda", "Melissa", "Michelle", "Stephanie",
  "Nicole", "Angela", "Christina", "Samantha", "Katherine", "Christine",
  "Deborah", "Rachel", "Laura", "Carolyn", "Janet", "Catherine",
  "Maria", "Frances", "Ann", "Joyce", "Diane", "Alice",
  "Julie", "Heather", "Teresa", "Gloria", "Evelyn", "Cheryl",
  "Mildred", "Martha", "Donna", "Dorothy", "Sharon", "Betty",
  "Helen", "Sandra", "Kimberly", "Emily", "Brenda", "Amy",
  "Anna", "Rebecca", "Virginia", "Pamela", "Cynthia", "Ruth",
  "Kathleen", "Linda", "Nancy", "Karen", "Margaret", "Marie",
];

const LAST_NAMES = [
  "Jenkins", "Perry", "Powell", "Long", "Patterson", "Hughes",
  "Washington", "Butler", "Simmons", "Foster", "Gonzales", "Bryant",
  "Alexander", "Russell", "Griffin", "Hayes", "Myers", "Ford",
  "Hamilton", "Graham", "Sullivan", "Wallace", "Woods", "Cole",
  "West", "Jordan", "Owens", "Reynolds", "Fisher", "Ellis",
  "Harrison", "Gibson", "McDonald", "Marshall", "Ortega", "Mack",
  "Burns", "Kelley", "Dunn", "Crawford", "Henry", "Vasquez",
  "Dean", "Lane", "Soto", "Lynch", "Stone", "Dixon",
  "Hicks", "Weaver", "Hart", "Hunt", "Palmer", "Robertson",
  "Black", "Holmes", "Rose", "Spencer", "Francis", "Stephens",
  "Vargas", "Herrera", "Medina", "Aguilar", "Salazar", "Delgado",
  "Vega", "Rios", "Romero", "Guerrero", "Castro", "Estrada",
  "Contreras", "Fuentes", "Leon", "Acosta", "Maldonado", "Rosales",
];

const GEOGRAPHIC_TERMS = [
  "Bend", "Trace", "Crossing", "Circle", "Court", "Place",
  "Hollow", "Branch", "Pass", "Point", "Island",
  "Terrace", "Stone", "Cedar", "Pine", "Elm", "Cypress",
  "Willow", "Birch", "Holly", "Sage", "Laurel",
  "Magnolia", "Pecan", "Mesquite", "Live Oak", "Post Oak",
  "Oaks", "Pines", "Hills", "Springs", "Falls", "Shores",
  "Estates", "Landing", "Overlook", "Retreat", "Haven",
  "Commons", "Gardens", "Heights", "Pointe",
];

const ENTITY_TERMS = [
  "Ventures", "Services", "Solutions", "Group", "International",
  "National", "Resources", "Global", "Enterprises", "Partners",
  "Advisors", "Consulting", "Management", "Funding",
  "Alliance", "Network", "Labs", "Studio", "Works",
  "Builders", "Homes", "Communities", "Residential",
  "Rentals", "Housing", "Leasing", "Mortgage",
];

const NEIGHBORHOOD_TERMS = [
  "Lakeway", "Pflugerville", "Steiner", "Avery", "Circle C",
  "Dripping Springs", "Onion Creek", "Shady Hollow", "Travis Country",
  "Barton Creek", "Westover", "Bryker Woods", "North Loop",
  "South Congress", "East Riverside", "South Lamar", "North Austin",
  "Bee Cave", "Lakeline", "Brushy Creek", "Leander",
  "Highland", "Clarksville", "Old West Austin", "Bouldin Creek",
  "Travis Heights", "South Austin", "North Lamar", "East Austin",
];

// ── Tier 1: Dense term expansions ────────────────────────────────────

async function getDenseTermExpansions(searched: Set<string>): Promise<string[]> {
  const dense = await prisma.searchTermAnalytics.findMany({
    where: {
      OR: [
        { maxResults: { gte: DENSE_MAX_RESULTS_THRESHOLD } },
        { avgResultsPerSearch: { gte: DENSE_AVG_RESULTS_THRESHOLD } },
      ],
    },
    orderBy: { avgResultsPerSearch: "desc" },
    select: { searchTerm: true, maxResults: true, avgResultsPerSearch: true },
  });

  const expansions: string[] = [];
  const seen = new Set<string>();

  for (const row of dense) {
    const base = row.searchTerm;
    for (const ch of ALPHABET) {
      const expanded = base + ch;
      const lower = expanded.toLowerCase();
      if (expanded.length < MIN_TERM_LENGTH) continue;
      if (searched.has(lower)) continue;
      if (seen.has(lower)) continue;
      seen.add(lower);
      expansions.push(expanded);
    }
  }

  return expansions;
}

// ── Tier 2: Analytics seed expansions ────────────────────────────────

async function getAnalyticsSeedTerms(searched: Set<string>): Promise<string[]> {
  const highYield = await prisma.searchTermAnalytics.findMany({
    where: {
      successRate: { gte: SEED_MIN_SUCCESS_RATE },
      avgResultsPerSearch: { gte: SEED_MIN_AVG_RESULTS },
    },
    orderBy: { avgResultsPerSearch: "desc" },
    select: { searchTerm: true },
  });

  // Extract unique 4-char prefixes from high-yield terms
  const prefixes = new Set<string>();
  for (const row of highYield) {
    if (row.searchTerm.length >= MIN_TERM_LENGTH) {
      prefixes.add(row.searchTerm.substring(0, MIN_TERM_LENGTH).toLowerCase());
    }
  }

  // Expand each prefix by appending a-z
  const expansions: string[] = [];
  const seen = new Set<string>();

  for (const prefix of prefixes) {
    for (const ch of ALPHABET) {
      const expanded = prefix + ch;
      if (searched.has(expanded)) continue;
      if (seen.has(expanded)) continue;
      seen.add(expanded);
      expansions.push(expanded);
    }
  }

  return expansions;
}

// ── Tier 3: Unexplored prefix gap analysis ───────────────────────────

async function getUnexploredPrefixes(searched: Set<string>): Promise<string[]> {
  // Build set of all 4-char prefixes already searched
  const searchedPrefixes = new Set<string>();
  for (const term of searched) {
    if (term.length >= MIN_TERM_LENGTH) {
      searchedPrefixes.add(term.substring(0, MIN_TERM_LENGTH));
    }
  }

  // Common first letters for property names/owners in Travis County
  // (uppercase-style patterns: names start A-Z, not q/x/z-heavy)
  const HIGH_FREQ_FIRST = "abcdefghjklmnoprstw";
  const CONSONANTS = "bcdfghjklmnpqrstvwxyz";
  const VOWELS = "aeiou";

  const candidates: string[] = [];
  const seen = new Set<string>();

  // Generate plausible 4-char prefixes: consonant-vowel or vowel-consonant patterns
  for (const c1 of HIGH_FREQ_FIRST) {
    for (const c2 of ALPHABET) {
      for (const c3 of ALPHABET) {
        // Only keep if it looks like a name/word start (has at least one vowel in first 3 chars)
        const first3 = c1 + c2 + c3;
        const hasVowel = [...first3].some((ch) => VOWELS.includes(ch));
        const hasConsonant = [...first3].some((ch) => CONSONANTS.includes(ch));
        if (!hasVowel || !hasConsonant) continue;

        for (const c4 of ALPHABET) {
          const prefix = c1 + c2 + c3 + c4;
          if (searchedPrefixes.has(prefix)) continue;
          if (searched.has(prefix)) continue;
          if (seen.has(prefix)) continue;
          seen.add(prefix);
          candidates.push(prefix);
        }
      }
    }
  }

  // Shuffle deterministically (by prefix hash) to avoid alphabetical bias
  candidates.sort((a, b) => simpleHash(a) - simpleHash(b));

  return candidates;
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h;
}

// ── Tier 4: Static fallback pool ─────────────────────────────────────

function getStaticFallbackTerms(): string[] {
  return [
    ...FIRST_NAMES,
    ...LAST_NAMES,
    ...GEOGRAPHIC_TERMS,
    ...ENTITY_TERMS,
    ...NEIGHBORHOOD_TERMS,
  ];
}

// ── Main ─────────────────────────────────────────────────────────────

interface TierResult {
  name: string;
  count: number;
}

async function main() {
  console.log(`\n=== Search Term Generator (Adaptive Prefix) ===`);
  console.log(`Target: ${TARGET_TERM_COUNT} new terms\n`);

  // 1. Get already-searched terms
  console.log("Fetching already-searched terms...");
  const analyticsRows = await prisma.searchTermAnalytics.findMany({
    select: { searchTerm: true },
  });
  const searched = new Set<string>();
  for (const r of analyticsRows) searched.add(r.searchTerm.toLowerCase());
  console.log(`  Already searched: ${searched.size} terms`);

  // 2. Generate terms tier by tier
  const candidates: string[] = [];
  const seen = new Set<string>();
  const tierResults: TierResult[] = [];

  function addFromTier(tierName: string, terms: string[]): void {
    let added = 0;
    for (const term of terms) {
      if (candidates.length >= TARGET_TERM_COUNT) break;
      const lower = term.toLowerCase();
      if (searched.has(lower)) continue;
      if (seen.has(lower)) continue;
      if (term.length < MIN_TERM_LENGTH) continue;
      seen.add(lower);
      candidates.push(term);
      added++;
    }
    tierResults.push({ name: tierName, count: added });
    console.log(`  ${tierName}: +${added} terms (total: ${candidates.length})`);
  }

  // Tier 1: Dense term expansions
  console.log("\nTier 1: Expanding dense terms (maxResults > 5000)...");
  const denseExpansions = await getDenseTermExpansions(searched);
  addFromTier("Dense expansions", denseExpansions);

  // Tier 2: Analytics seed expansions
  if (candidates.length < TARGET_TERM_COUNT) {
    console.log("Tier 2: Analytics seed prefix expansions...");
    const seedExpansions = await getAnalyticsSeedTerms(searched);
    addFromTier("Seed expansions", seedExpansions);
  }

  // Tier 3: Unexplored prefix gap fill
  if (candidates.length < TARGET_TERM_COUNT) {
    console.log("Tier 3: Unexplored prefix gap analysis...");
    const gapPrefixes = await getUnexploredPrefixes(searched);
    addFromTier("Gap prefixes", gapPrefixes);
  }

  // Tier 4: Static fallback
  if (candidates.length < TARGET_TERM_COUNT) {
    console.log("Tier 4: Static fallback arrays...");
    const fallbacks = getStaticFallbackTerms();
    addFromTier("Static fallbacks", fallbacks);
  }

  // 3. Output
  if (OUTPUT_JSON) {
    console.log("\n" + JSON.stringify(candidates, null, 2));
  } else {
    console.log("\n// ── Generated terms (paste into FALLBACK_TERMS or batch-configs) ──");
    const lines: string[] = [];
    for (let i = 0; i < candidates.length; i += 8) {
      const chunk = candidates.slice(i, i + 8);
      lines.push("\t" + chunk.map((t) => `"${t}"`).join(", ") + ",");
    }
    console.log("const GENERATED_TERMS: readonly string[] = [");
    for (const line of lines) console.log(line);
    console.log("];");
  }

  // 4. Optional: enqueue
  if (SHOULD_ENQUEUE) {
    console.log(`\nEnqueuing ${candidates.length} terms...`);
    let enqueued = 0;
    for (const term of candidates) {
      try {
        await scraperQueue.add(
          "scrape-properties",
          { searchTerm: term, userId: "generate-search-terms", scheduled: true },
          { attempts: 3, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: 100, removeOnFail: 50 },
        );
        enqueued++;
      } catch (error) {
        console.error(`  Failed to enqueue "${term}": ${getErrorMessage(error)}`);
      }
    }
    console.log(`  Enqueued ${enqueued}/${candidates.length} terms`);
    await scraperQueue.close();
  }

  // 5. Summary
  console.log(`\n=== Summary ===`);
  console.log(`  Total generated: ${candidates.length}`);
  console.log(`  Already searched: ${searched.size}`);
  for (const tier of tierResults) {
    console.log(`  ${tier.name}: ${tier.count}`);
  }
  if (SHOULD_ENQUEUE) console.log(`  Enqueued: yes`);
  console.log("");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", getErrorMessage(err));
  process.exit(1);
});
