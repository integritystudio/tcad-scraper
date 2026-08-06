/**
 * Backfill 2025 TCAD properties using NOVEL terms mined from 2026-only
 * properties — owner names that have NEVER been searched before.
 *
 * These are terms like NGUYEN, MARTINEZ, HERNANDEZ etc. that appear on
 * 2026 properties with no 2025 counterpart and haven't been used as
 * search terms in any prior scrape.
 *
 * Usage: TCAD_YEAR=2025 doppler run -- npx tsx scripts/backfill-2025-novel.ts
 */

import { MIN_TERM_LENGTH } from "../utils/constants";
import { runBackfillMain } from "./lib/backfill-runner";
import { prisma } from "./lib/d1-prisma";
import { getSearchedTermSets } from "./lib/searched-terms";

const MAX_CONSECUTIVE_ZERO_BATCHES = 5;
const MIN_PROPS_PER_TERM = 10;

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
	const { allSearched: searched } = await getSearchedTermSets();
	console.log(`  Already-searched terms: ${searched.size}`);

	// Collect all candidates with their yields from all sources
	const candidates: CandidateTerm[] = [];

	// ── Source 1: Owner first-words from 2026-only properties ──────────
	console.log("  Mining owner first-words from 2026-only properties...");
	const firstWords = await prisma.$queryRaw<
		Array<{ word: string; cnt: number }>
	>`
    WITH words AS (
      SELECT property_id, substr(name, 1, instr(name || ' ', ' ') - 1) AS word
      FROM properties
      WHERE year = 2026
      AND property_id NOT IN (SELECT property_id FROM properties WHERE year = 2025)
    )
    SELECT word, COUNT(DISTINCT property_id) as cnt
    FROM words
    WHERE LENGTH(word) >= ${MIN_TERM_LENGTH} AND word GLOB '[A-Za-z]*'
    GROUP BY word
    HAVING COUNT(DISTINCT property_id) >= ${MIN_PROPS_PER_TERM}
    ORDER BY cnt DESC`;
	for (const w of firstWords)
		candidates.push({ term: w.word, yield: w.cnt, source: "owner" });
	console.log(`    First-words mined: ${firstWords.length}`);

	// ── Source 2: Street names from 2026-only properties ───────────────
	console.log("  Mining street names from 2026-only properties...");
	const streets = await prisma.$queryRaw<
		Array<{ street: string; cnt: number }>
	>`
    WITH rests AS (
      SELECT property_id,
             substr(property_address || ' ', instr(property_address || ' ', ' ') + 1) AS rest
      FROM properties
      WHERE year = 2026
      AND property_id NOT IN (SELECT property_id FROM properties WHERE year = 2025)
      AND property_address IS NOT NULL
    ),
    words AS (
      SELECT property_id, substr(rest, 1, instr(rest || ' ', ' ') - 1) AS street
      FROM rests
    )
    SELECT street, COUNT(DISTINCT property_id) as cnt
    FROM words
    WHERE LENGTH(street) >= ${MIN_TERM_LENGTH} AND street GLOB '[A-Za-z]*'
    GROUP BY street
    HAVING COUNT(DISTINCT property_id) >= ${MIN_PROPS_PER_TERM}
    ORDER BY cnt DESC`;
	for (const s of streets)
		candidates.push({ term: s.street, yield: s.cnt, source: "street" });
	console.log(`    Street names mined: ${streets.length}`);

	// ── Source 3: Description first-words from 2026-only properties ────
	console.log("  Mining description keywords...");
	const descs = await prisma.$queryRaw<Array<{ word: string; cnt: number }>>`
    WITH words AS (
      SELECT property_id,
             substr(description, 1, instr(description || ' ', ' ') - 1) AS word
      FROM properties
      WHERE year = 2026
      AND property_id NOT IN (SELECT property_id FROM properties WHERE year = 2025)
      AND description IS NOT NULL
    )
    SELECT word, COUNT(DISTINCT property_id) as cnt
    FROM words
    WHERE LENGTH(word) >= ${MIN_TERM_LENGTH} AND word GLOB '[A-Za-z]*'
    GROUP BY word
    HAVING COUNT(DISTINCT property_id) >= ${MIN_PROPS_PER_TERM}
    ORDER BY cnt DESC`;
	for (const d of descs)
		candidates.push({ term: d.word, yield: d.cnt, source: "desc" });
	console.log(`    Description keywords mined: ${descs.length}`);

	// ── Source 4: Two-word owner names from 2026-only properties ───────
	console.log("  Mining two-word owner names...");
	const twoWords = await prisma.$queryRaw<
		Array<{ phrase: string; cnt: number }>
	>`
    WITH split1 AS (
      SELECT property_id,
             substr(name, 1, instr(name || ' ', ' ') - 1) AS w1,
             substr(name || ' ', instr(name || ' ', ' ') + 1) AS rest
      FROM properties
      WHERE year = 2026
      AND property_id NOT IN (SELECT property_id FROM properties WHERE year = 2025)
    ),
    split2 AS (
      SELECT property_id, w1, substr(rest, 1, instr(rest || ' ', ' ') - 1) AS w2
      FROM split1
    )
    SELECT w1 || ' ' || w2 as phrase, COUNT(DISTINCT property_id) as cnt
    FROM split2
    WHERE LENGTH(w1) >= ${MIN_TERM_LENGTH} AND LENGTH(w2) >= 2
    AND w1 GLOB '[A-Za-z]*'
    GROUP BY phrase
    HAVING COUNT(DISTINCT property_id) >= ${MIN_PROPS_PER_TERM}
    ORDER BY cnt DESC`;
	for (const t of twoWords)
		candidates.push({ term: t.phrase, yield: t.cnt, source: "two-word" });
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
		if (seen.has(lower)) {
			skippedDupe++;
			continue;
		}
		if (searched.has(lower)) {
			skippedSearched++;
			continue;
		}
		// Skip if this term is a prefix of an already-searched longer term
		// e.g. "fort" skipped because "fortenberry" was already searched
		if (searchedPrefixes.has(lower)) {
			skippedPrefix++;
			continue;
		}
		seen.add(lower);
		result.push(c.term);
	}

	console.log(
		`  Skipped: ${skippedSearched} already-searched, ${skippedPrefix} prefix-of-searched, ${skippedDupe} dupes`,
	);
	console.log(`  Final novel terms: ${result.length}`);
	return result;
}

runBackfillMain({
	getTerms: getNovelTerms,
	userId: "backfill-2025-novel",
	label: "Novel Owner Names",
	maxConsecutiveZeroBatches: MAX_CONSECUTIVE_ZERO_BATCHES,
});
