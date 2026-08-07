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
 *  - Skips terms where a shorter prefix (4+ chars) was already searched
 *  - Skips multi-word terms where ANY word was already searched
 *  - Skips DB-blacklisted terms (zero-yield after 3+ searches)
 *
 * Usage:
 *   doppler run -- npx tsx scripts/generate-next-200-terms.ts
 *   doppler run -- npx tsx scripts/generate-next-200-terms.ts --enqueue
 */

import { pathToFileURL } from "node:url";
import { MIN_TERM_LENGTH } from "../utils/constants";
import { BACKFILL_2025_STATIC_TERMS } from "./config/backfill-2025-static-terms";
import { isSupersetOfAny } from "./lib/backfill-utils";
import {
	BUSINESS_ENTITY,
	FIRST_NAMES_FEMALE,
	FIRST_NAMES_MALE,
	LAST_NAMES,
	STREET_GEOGRAPHIC,
} from "./lib/curated-names";
import { generateCvcvBases } from "./lib/cvcv";
import { prisma } from "./lib/d1-prisma";
import { enqueueBatch } from "./lib/queue-utils";
import { runMain } from "./lib/run-main";
import {
	getBlacklistedTermSet,
	getSearchedTermSets,
} from "./lib/searched-terms";

const TARGET_TERM_COUNT = 200;

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

/**
 * Count existing D1 rows matching each term (name or address substring).
 * Uses $queryRawUnsafe because the SUM(CASE ...) column list can't be
 * parameterized; terms are internal (curated lists + generated prefixes)
 * and both quotes and LIKE wildcards are escaped.
 */
async function scoreTermsByDbMatches(
	terms: string[],
): Promise<Map<string, number>> {
	const scores = new Map<string, number>();
	for (let i = 0; i < terms.length; i += YIELD_SCORE_CHUNK_SIZE) {
		const chunk = terms.slice(i, i + YIELD_SCORE_CHUNK_SIZE);
		const cols = chunk
			.map((t, j) => {
				const esc = t.replace(/'/g, "''").replace(/[\\%_]/g, "\\$&");
				return `SUM(CASE WHEN name LIKE '%${esc}%' ESCAPE '\\' OR property_address LIKE '%${esc}%' ESCAPE '\\' THEN 1 ELSE 0 END) AS c${j}`;
			})
			.join(", ");
		const [row] = await prisma.$queryRawUnsafe<
			Array<Record<string, number | bigint | null>>
		>(`SELECT ${cols} FROM properties`);
		if (!row) {
			console.error(`Yield scoring: empty result for chunk at ${i}; scoring 0`);
			chunk.forEach((t) => scores.set(t, 0));
			continue;
		}
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
	// Matches an extreme number of properties (Living/Family/Revocable
	// Trust, etc. — 23,852 matches, ~24 pages). Timed out 3/3 retries before
	// per-page checkpointing (16449c5, fixing incident 2026-08-06) and now
	// completes; still not worth the TCAD API load for a re-scrape of an
	// already-searched, generic term with minimal new-property yield.
	"trust",
]);

// ── Term pools ────────────────────────────────────────────────────────
// Sourced from lib/curated-names.ts — the canonical name/geo/entity data
// (see that file's docstring). Importing directly, rather than maintaining
// a second hand-picked copy here, keeps Tiers 1-2 from going stale the way
// a static list does once its entries are all searched (2026-08-07: the
// prior hand-picked lists were 100% exhausted, silently collapsing Tiers
// 1-2 to zero candidates every run). Overlap with other active-pool sources
// (BATCH_CONFIGS, FALLBACK_TERMS) is expected and resolved at runtime by
// getSearchedTermSets() — see utils/list-all-search-terms.ts.
//
// curated-names.ts's own sub-lists overlap each other (e.g. "Casey" is both
// a female and male first name; "Grace"/"Vista" work as both a name and a
// geo/entity term), and BACKFILL_2025_STATIC_TERMS overlaps them too. Each
// term is assigned to exactly one bucket below, first-match-wins in
// tier-priority order, so utils/list-curated-terms.ts's `duplicated` bucket
// (each term lives in exactly one list within this pool) stays empty.
const usedLower = new Set(
	BACKFILL_2025_STATIC_TERMS.map((t) => t.toLowerCase()),
);
const assignUnique = (list: readonly string[]): string[] => {
	const out: string[] = [];
	for (const term of list) {
		const lower = term.toLowerCase();
		if (usedLower.has(lower)) continue;
		usedLower.add(lower);
		out.push(term);
	}
	return out;
};

export const CANDIDATE_FIRST_NAMES: readonly string[] = assignUnique([
	...FIRST_NAMES_FEMALE,
	...FIRST_NAMES_MALE,
]);
export const CANDIDATE_LAST_NAMES: readonly string[] = assignUnique(LAST_NAMES);
export const CANDIDATE_GEOGRAPHIC: readonly string[] =
	assignUnique(STREET_GEOGRAPHIC);
export const CANDIDATE_ENTITY: readonly string[] =
	assignUnique(BUSINESS_ENTITY);

export async function main(enqueueMode = false) {
	// 1. Load all already-searched terms (analytics + property searchTerm + recent jobs)
	const { allSearched: searched } = await getSearchedTermSets();

	// 2. Load blacklisted terms (zero-yield after repeated searches — hard
	// skip; the failed-only carve-out excludes them from allSearched)
	const blacklistSet = await getBlacklistedTermSet();

	console.error(
		`Already searched: ${searched.size} | Blacklisted: ${blacklistSet.size}`,
	);

	// ── Selection helpers ──────────────────────────────────────────────

	const selected: string[] = [];
	const selectedSet = new Set<string>();
	let blacklistSkips = 0;
	let prefixSkips = 0;
	let multiWordSkips = 0;

	/**
	 * Check if any word in a multi-word term was already searched individually.
	 * "Homes Trust" → skip if "homes" OR "trust" was searched (results are subsets).
	 * Words shorter than MIN_TERM_LENGTH (e.g. "LLC") are never checked.
	 */
	const hasSearchedWord = (term: string): boolean => {
		const words = term.split(/\s+/);
		if (words.length < 2) return false;
		return words.some(
			(w) => w.length >= MIN_TERM_LENGTH && searched.has(w.toLowerCase()),
		);
	};

	const addNewTerm = (term: string): boolean => {
		if (selected.length >= TARGET_TERM_COUNT) return false;
		if (!term || term.length < MIN_TERM_LENGTH) return false;
		const lower = term.toLowerCase();
		if (BLOCKED_TERMS.has(lower)) return false;
		if (searched.has(lower)) return false;
		if (selectedSet.has(lower)) return false;

		// Zero-yield after repeated searches — hard skip
		if (blacklistSet.has(lower)) {
			blacklistSkips++;
			return false;
		}

		// Multi-word: skip if any word was already searched
		if (hasSearchedWord(term)) {
			multiWordSkips++;
			return false;
		}

		// Skip if a shorter prefix was already searched — TCAD search is
		// prefix-based, so "Lago" results are a subset of any search that
		// already matched the same owners via a shorter prefix
		if (isSupersetOfAny(lower, searched)) {
			prefixSkips++;
			return false;
		}

		selected.push(term);
		selectedSet.add(lower);
		return true;
	};

	// For re-scrape candidates (already in searched set — skip prefix check)
	const addRescrape = (term: string): boolean => {
		if (selected.length >= TARGET_TERM_COUNT) return false;
		if (!term || term.length < MIN_TERM_LENGTH) return false;
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
	let tier5Count = 0;

	const prefixes = generateCvcvBases();
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
		`\nSkipped: ${blacklistSkips} blacklisted, ${prefixSkips} prefix overlap, ${multiWordSkips} multi-word overlap`,
	);
	console.error(`Total: ${selected.length} terms`);

	const ranked = await rankByPredictedYield(selected);

	for (const term of ranked) {
		console.log(term);
	}

	if (enqueueMode && ranked.length > 0) {
		console.error(`\nEnqueuing ${ranked.length} terms via Workers API...`);
		const queued = await enqueueBatch(ranked);
		console.error(`Enqueued ${queued.length} jobs`);
	}
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	runMain(() => main(process.argv.includes("--enqueue")));
}
