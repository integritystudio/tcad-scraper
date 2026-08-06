/**
 * Generate the next most-effective search terms for TCAD 2025 backfill.
 *
 * Priority order (new discovery first, re-scrape last):
 *  1. Unsearched names common in Travis County (first + last)
 *  2. Unsearched geographic / subdivision / entity terms
 *  3. Prefix expansions of dense base terms (append a-z to high-yield roots)
 *  4. High-yield single-search analytics terms (re-scrape, already harvested once)
 *  5. 4-char prefix gap fill (consonant-vowel patterns not yet searched)
 *
 * Deduplication:
 *  - Uses SearchTermDeduplicator (superset, business suffix, multi-word checks)
 *  - Skips terms where a shorter prefix (4+ chars) was already searched
 *  - Skips multi-word terms where ANY word was already searched
 *  - Loads DB blacklist (zero-yield after 3+ searches)
 *
 * Usage:
 *   doppler run -- npx tsx scripts/generate-next-200-terms.ts
 *   doppler run -- npx tsx scripts/generate-next-200-terms.ts --enqueue
 */

import { SearchTermDeduplicator } from "./lib/search-term-deduplicator";
import { prisma } from "./lib/d1-prisma";
import { enqueueBatch } from "./lib/queue-utils";
import { getSearchedTermSets } from "./lib/searched-terms";

const TARGET_TERM_COUNT = 500;

// ── Yield scoring (see docs/SEARCH_TERMS.md → "Predicting yield") ────
// In-DB match frequency measures TCAD-side abundance AND existing coverage,
// so the extremes are busts: near-zero matchers don't exist in TCAD either,
// and very high matchers are already captured by overlapping terms. The
// mid-band yields best (measured 2026-08-06: Teve 2,678 matches → 3 new;
// Para 264 matches → 282 new). Band bounds scale with current DB size.
const YIELD_SCORE_CHUNK_SIZE = 25;
const YIELD_MIN_MATCHES = 5;
const YIELD_BAND_LOW = 100;
const YIELD_BAND_HIGH = 1000;
const YIELD_BAND_REF_DB_ROWS = 260_000;

/** Count existing D1 rows matching each term (name or address substring). */
async function scoreTermsByDbMatches(
	terms: string[],
): Promise<Map<string, number>> {
	const scores = new Map<string, number>();
	for (let i = 0; i < terms.length; i += YIELD_SCORE_CHUNK_SIZE) {
		const chunk = terms.slice(i, i + YIELD_SCORE_CHUNK_SIZE);
		const cols = chunk
			.map((t, j) => {
				const esc = t.replace(/'/g, "''");
				return `SUM(CASE WHEN name LIKE '%${esc}%' OR property_address LIKE '%${esc}%' THEN 1 ELSE 0 END) AS c${j}`;
			})
			.join(", ");
		const [row] = await prisma.$queryRawUnsafe<
			Array<Record<string, number | bigint | null>>
		>(`SELECT ${cols} FROM properties`);
		chunk.forEach((t, j) => scores.set(t, Number(row[`c${j}`] ?? 0)));
	}
	return scores;
}

/**
 * Drop near-zero matchers and order the rest mid-band first. Returns the
 * filtered list; logs what was dropped.
 */
async function rankByPredictedYield(terms: string[]): Promise<string[]> {
	const scores = await scoreTermsByDbMatches(terms);
	const dbRows = Number(await prisma.property.count());
	const scale = dbRows / YIELD_BAND_REF_DB_ROWS;
	const low = YIELD_BAND_LOW * scale;
	const high = YIELD_BAND_HIGH * scale;

	const kept = terms.filter((t) => (scores.get(t) ?? 0) >= YIELD_MIN_MATCHES);
	// 0 = mid-band (best), 1 = below band, 2 = above band (most overlap)
	const bandRank = (n: number): number =>
		n >= low && n <= high ? 0 : n < low ? 1 : 2;
	kept.sort((a, b) => {
		const sa = scores.get(a) ?? 0;
		const sb = scores.get(b) ?? 0;
		return bandRank(sa) - bandRank(sb) || sb - sa;
	});

	console.error(
		`\nYield scoring: kept ${kept.length}/${terms.length} ` +
			`(dropped ${terms.length - kept.length} with <${YIELD_MIN_MATCHES} in-DB matches; ` +
			`band ${Math.round(low)}-${Math.round(high)} on ${dbRows} rows)`,
	);
	return kept;
}

// Terms that cause TCAD API timeouts or truncated responses — hard skip
const BLOCKED_TERMS = new Set([
	"street",
	"drive",
	"lane",
	"road",
	"way",
	"court",
	"place",
	"circle",
	"avenue",
	"boulevard",
	"belterra",
	"fiduciary",
	"lakeline boulevard",
	"lmtd",
	"maple run",
	"mesa park",
	"nonprofit",
	"pemberton heights",
	"residential builders",
	"sendero springs",
	"wayg",
	"wayh",
	"wayi",
	"wayj",
	"escrow",
]);

// ── Static term pools ──────────────────────────────────────────────────

const CANDIDATE_FIRST_NAMES = [
	"Christine",
	"Theresa",
	"Cynthia",
	"Diane",
	"Ruth",
	"Brenda",
	"Jacqueline",
	"Emily",
	"Andrea",
	"Denise",
	"Debra",
	"Tammy",
	"Tracy",
	"Dorothy",
	"Joyce",
	"Cheryl",
	"Heather",
	"Teresa",
	"Tiffany",
	"Victoria",
	"Kimberly",
	"Carolyn",
	"Janet",
	"Frances",
	"Megan",
	"Robin",
	"Amber",
	"Crystal",
	"Brittany",
	"Diana",
	"Samantha",
	"Vanessa",
	"Lauren",
	"Natalie",
	"Bethany",
	"Allison",
	"Miranda",
	"Cassandra",
	"Priscilla",
	"Jeanette",
	"Lorraine",
	"Phillip",
	"Willie",
	"Terry",
	"Randy",
	"Johnny",
	"Albert",
	"Russell",
	"Bobby",
	"Victor",
	"Eugene",
	"Ralph",
	"Louis",
	"Philip",
	"Harry",
	"Wayne",
	"Howard",
	"Jesse",
	"Douglas",
	"Henry",
	"Arthur",
	"Leonard",
	"Gerald",
	"Walter",
	"Dennis",
	"Bruce",
	"Clarence",
	"Lawrence",
	"Norman",
	"Patrick",
	"Carlos",
	"Craig",
	"Billy",
	"Harold",
	"Shawn",
	"Derrick",
	"Duane",
	"Joel",
	"Fernando",
	"Roberto",
	"Francisco",
	"Arturo",
	"Armando",
	"Alfredo",
	"Alberto",
	"Salvador",
	"Enrique",
	"Ernesto",
	"Gustavo",
	"Gerardo",
	"Guillermo",
	"Adriana",
	"Leticia",
	"Yolanda",
	"Claudia",
	"Maribel",
	"Cristina",
	"Gabriela",
	"Graciela",
	"Alejandra",
	"Consuelo",
	"Esperanza",
	"Mercedes",
	"Rosario",
	"Socorro",
	"Gilberto",
	"Humberto",
	"Osvaldo",
	"Rigoberto",
];

const CANDIDATE_LAST_NAMES = [
	"Perry",
	"Powell",
	"Butler",
	"Bell",
	"Foster",
	"Henderson",
	"Coleman",
	"Jenkins",
	"Ward",
	"Richardson",
	"Watson",
	"Gray",
	"Reyes",
	"Hayes",
	"Russell",
	"Griffin",
	"Kelly",
	"Marshall",
	"Hamilton",
	"Graham",
	"Reynolds",
	"Mason",
	"Hunt",
	"Webb",
	"Duncan",
	"Harper",
	"Spencer",
	"Murray",
	"Ferguson",
	"Holland",
	"Dean",
	"Porter",
	"Hawkins",
	"Hicks",
	"Bishop",
	"Payne",
	"Sullivan",
	"Wagner",
	"Ford",
	"Palmer",
	"Meyer",
	"Schmidt",
	"Rice",
	"Burns",
	"Garrett",
	"Stephens",
	"Soto",
	"Medina",
	"Delgado",
	"Vargas",
	"Aguilar",
	"Contreras",
	"Fuentes",
	"Lara",
	"Acosta",
	"Rios",
	"Cardenas",
	"Molina",
	"Serrano",
	"Velasquez",
	"Estrada",
	"Ochoa",
	"Galvan",
	"Rangel",
	"Solis",
	"Villanueva",
	"Trejo",
	"Meza",
	"Juarez",
	"Dominguez",
	"Ayala",
	"Camacho",
	"Cervantes",
	"Espinoza",
	"Figueroa",
	"Guerrero",
	"Ibarra",
	"Jacobo",
	"Lugo",
	"Maldonado",
	"Navarro",
	"Orozco",
	"Pacheco",
	"Quintero",
	"Rivas",
	"Salas",
	"Tapia",
	"Valdez",
	"Zamora",
	"Bautista",
	"Cisneros",
];

const CANDIDATE_GEOGRAPHIC = [
	"Brushy",
	"Cypress",
	"Onion",
	"Walnut",
	"Jollyville",
	"Wells",
	"Horizon",
	"Sunset",
	"Terra",
	"Oasis",
	"Shadow",
	"Dove",
	"Deer",
	"Falcon",
	"Eagle",
	"Hawk",
	"Quail",
	"Lakeshore",
	"Riverside",
	"Creekside",
	"Ridgeline",
	"Stonewall",
	"Whitestone",
	"Round Rock",
	"Manor",
	"Elgin",
	"Hutto",
	"Georgetown",
	"Dripping",
	"Lago",
	"Lakeway",
	"Steiner",
	"Avery",
	"Anderson Mill",
	"Circle C",
	"Shady Hollow",
	"Travis Country",
	"Lantana",
	"Senna",
	"Scofield",
	"Wells Branch",
	"Parmer",
	"Slaughter",
	"Stassney",
	"Oltorf",
	"Rundberg",
	"Burnet",
	"Research",
	"Lamar",
	"Guadalupe",
	"Congress",
	"Riverside",
	"Pleasant",
	"William Cannon",
	"Ben White",
	"Braker",
	"Duval",
	"Metric",
	"Dessau",
	"Cameron",
];

const CANDIDATE_ENTITY = [
	// Single-word entity terms only — compound terms like "X LLC" are
	// subsets of already-searched base words and get filtered by dedup
	"Management",
	"Venture",
	"Equity",
	"Asset",
	"Advisors",
	"Enterprises",
	"National",
	"Alliance",
	"Heritage",
	"Legacy",
	"Premier",
	"Strategic",
	"Consulting",
	"Builder",
	"Custom",
	"Design",
	"Landscape",
	"Solar",
	"Energy",
	"Rental",
	"Storage",
	"Retail",
	"Church",
	"School",
	"Hospital",
	"Medical",
	"Health",
	"Tech",
	"Software",
	"Digital",
	"Studio",
	"Gallery",
	"Fitness",
	"Lending",
	"Mortgage",
	"Title",
	"Brokerage",
	"Auction",
];

export async function main(enqueueMode = false) {
	// 1. Load all already-searched terms (analytics + property searchTerm + recent jobs)
	const { allSearched: searched } = await getSearchedTermSets();

	// 2. Load blacklisted terms
	const blacklisted = await prisma.searchTermAnalytics.findMany({
		where: { successRate: 0, totalSearches: { gte: 3 } },
		select: { searchTerm: true },
	});
	const blacklistSet = new Set(
		blacklisted.map((b) => b.searchTerm.toLowerCase()),
	);

	// 3. Initialize deduplicator seeded with all searched terms
	const deduplicator = new SearchTermDeduplicator(new Set(searched));
	for (const term of blacklistSet) {
		deduplicator.forceBlacklist(term);
	}

	console.error(
		`Already searched: ${searched.size} | Blacklisted: ${blacklistSet.size}`,
	);

	// ── Selection helpers ──────────────────────────────────────────────

	const selected: string[] = [];
	const selectedSet = new Set<string>();
	let dedupSkips = 0;
	let prefixSkips = 0;
	let multiWordSkips = 0;

	/**
	 * Check if a candidate term has a shorter prefix (4+ chars) already in searched.
	 * TCAD search is prefix-based, so "Lago" results are a subset of any search
	 * that already matched the same owner names via a shorter prefix.
	 */
	const hasSearchedPrefix = (term: string): boolean => {
		const lower = term.toLowerCase();
		// Check all prefixes from 4 chars up to term.length - 1
		for (let len = 4; len < lower.length; len++) {
			if (searched.has(lower.slice(0, len))) return true;
		}
		return false;
	};

	/**
	 * Check if any word in a multi-word term was already searched individually.
	 * "Homes LLC" → skip if "homes" OR "llc" was searched (results are subsets).
	 */
	const hasSearchedWord = (term: string): boolean => {
		const words = term.split(/\s+/);
		if (words.length < 2) return false;
		return words.some((w) => w.length >= 4 && searched.has(w.toLowerCase()));
	};

	const addNewTerm = (term: string): boolean => {
		if (selected.length >= TARGET_TERM_COUNT) return false;
		if (!term || term.length < 4) return false;
		if (BLOCKED_TERMS.has(term.toLowerCase())) return false;
		if (searched.has(term.toLowerCase())) return false;
		if (selectedSet.has(term.toLowerCase())) return false;

		// Multi-word: skip if any word was already searched
		if (hasSearchedWord(term)) {
			multiWordSkips++;
			return false;
		}

		// Use deduplicator for superset / business suffix / blacklist checks
		if (deduplicator.shouldSkipTerm(term)) {
			dedupSkips++;
			return false;
		}

		// Skip if a shorter prefix of this term was already searched
		if (hasSearchedPrefix(term)) {
			prefixSkips++;
			return false;
		}

		selected.push(term);
		selectedSet.add(term.toLowerCase());
		deduplicator.markTermAsUsed(term);
		return true;
	};

	// For re-scrape candidates (already in searched set — skip prefix check)
	const addRescrape = (term: string): boolean => {
		if (selected.length >= TARGET_TERM_COUNT) return false;
		if (!term || term.length < 4) return false;
		if (BLOCKED_TERMS.has(term.toLowerCase())) return false;
		if (blacklistSet.has(term.toLowerCase())) return false;
		if (selectedSet.has(term.toLowerCase())) return false;
		selected.push(term);
		selectedSet.add(term.toLowerCase());
		return true;
	};

	// ── TIER 1: Unsearched names ─────────────────────────────────────
	let tier1Count = 0;
	for (const name of CANDIDATE_FIRST_NAMES) {
		if (addNewTerm(name)) tier1Count++;
	}
	for (const name of CANDIDATE_LAST_NAMES) {
		if (addNewTerm(name)) tier1Count++;
	}
	console.error(`Tier 1 (unsearched names): ${tier1Count}`);

	// ── TIER 2: Unsearched geographic + entity terms ─────────────────
	let tier2Count = 0;
	for (const term of CANDIDATE_GEOGRAPHIC) {
		if (addNewTerm(term)) tier2Count++;
	}
	for (const term of CANDIDATE_ENTITY) {
		if (addNewTerm(term)) tier2Count++;
	}
	console.error(`Tier 2 (geographic + entity): ${tier2Count}`);

	// ── TIER 3: Prefix expansions of dense roots ─────────────────────
	const denseTerms = await prisma.searchTermAnalytics.findMany({
		where: {
			avgResultsPerSearch: { gte: 500 },
			successRate: { gte: 0.5 },
			termLength: { lte: 5 },
		},
		orderBy: { avgResultsPerSearch: "desc" },
		select: { searchTerm: true },
	});

	let tier3Count = 0;
	for (const base of denseTerms) {
		if (selected.length >= TARGET_TERM_COUNT) break;
		for (let c = 97; c <= 122; c++) {
			const expanded = base.searchTerm + String.fromCharCode(c);
			if (addNewTerm(expanded)) tier3Count++;
			if (selected.length >= TARGET_TERM_COUNT) break;
		}
	}
	console.error(`Tier 3 (prefix expansions): ${tier3Count}`);

	// ── TIER 4: High-yield re-scrape candidates ──────────────────────
	const rescrape = await prisma.searchTermAnalytics.findMany({
		where: {
			totalSearches: 1,
			successRate: 1,
			avgResultsPerSearch: { gte: 200 },
		},
		orderBy: { avgResultsPerSearch: "desc" },
		select: { searchTerm: true, avgResultsPerSearch: true },
	});

	let tier4Count = 0;
	for (const row of rescrape) {
		if (addRescrape(row.searchTerm)) tier4Count++;
	}
	console.error(`Tier 4 (re-scrape high-yield): ${tier4Count}`);

	// ── TIER 5: 4-char prefix gap fill ───────────────────────────────
	const vowels = "aeiou";
	const consonants = "bcdfghjklmnpqrstvwxyz";
	let tier5Count = 0;

	const prefixes: string[] = [];
	for (const c1 of consonants) {
		for (const v1 of vowels) {
			for (const c2 of consonants) {
				for (const v2 of vowels) {
					prefixes.push(c1 + v1 + c2 + v2);
				}
			}
		}
	}
	// Fisher-Yates shuffle to avoid alphabetical bias
	for (let i = prefixes.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[prefixes[i], prefixes[j]] = [prefixes[j], prefixes[i]];
	}

	for (const p of prefixes) {
		if (selected.length >= TARGET_TERM_COUNT) break;
		const term = p.charAt(0).toUpperCase() + p.slice(1);
		if (addNewTerm(term)) tier5Count++;
	}
	console.error(`Tier 5 (4-char gap fill): ${tier5Count}`);

	// ── Output ───────────────────────────────────────────────────────
	console.error(
		`\nSkipped: ${dedupSkips} dedup, ${prefixSkips} prefix overlap, ${multiWordSkips} multi-word overlap`,
	);
	console.error(`Total: ${selected.length} terms`);

	const ranked = await rankByPredictedYield(selected);

	for (const term of ranked) {
		console.log(term);
	}

	if (enqueueMode && ranked.length > 0) {
		console.error(`\nEnqueuing ${ranked.length} terms via Workers API...`);
		const queued = await enqueueBatch(ranked, "next-200-gen");
		console.error(`Enqueued ${queued} jobs`);
	}
}

if (require.main === module) {
	main(process.argv.includes("--enqueue"))
		.catch(console.error)
		.finally(() => prisma.$disconnect());
}
