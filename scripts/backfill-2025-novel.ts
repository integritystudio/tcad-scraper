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
import { buildPrefixIndex } from "./lib/backfill-utils";
import {
	mineDescriptionFirstWords,
	mineOwnerFirstWords,
	mineStreetNames,
	mineTwoWordOwnerNames,
} from "./lib/mine-2026-terms";
import { getSearchedTermSets } from "./lib/searched-terms";

const MAX_CONSECUTIVE_ZERO_BATCHES = 5;
const MIN_PROPS_PER_TERM = 10;

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

	const mineOpts = { minCount: MIN_PROPS_PER_TERM, alphaOnly: true };

	// ── Source 1: Owner first-words from 2026-only properties ──────────
	console.log("  Mining owner first-words from 2026-only properties...");
	const firstWords = await mineOwnerFirstWords(mineOpts);
	for (const w of firstWords)
		candidates.push({ term: w.term, yield: w.count, source: "owner" });
	console.log(`    First-words mined: ${firstWords.length}`);

	// ── Source 2: Street names from 2026-only properties ───────────────
	console.log("  Mining street names from 2026-only properties...");
	const streets = await mineStreetNames(mineOpts);
	for (const s of streets)
		candidates.push({ term: s.term, yield: s.count, source: "street" });
	console.log(`    Street names mined: ${streets.length}`);

	// ── Source 3: Description first-words from 2026-only properties ────
	console.log("  Mining description keywords...");
	const descs = await mineDescriptionFirstWords(mineOpts);
	for (const d of descs)
		candidates.push({ term: d.term, yield: d.count, source: "desc" });
	console.log(`    Description keywords mined: ${descs.length}`);

	// ── Source 4: Two-word owner names from 2026-only properties ───────
	console.log("  Mining two-word owner names...");
	const twoWords = await mineTwoWordOwnerNames(mineOpts);
	for (const t of twoWords)
		candidates.push({ term: t.term, yield: t.count, source: "two-word" });
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
