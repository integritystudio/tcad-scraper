/**
 * Backfill a tax year using NOVEL terms mined from the year gap — owner
 * names that have NEVER been searched before.
 *
 * These are terms like NGUYEN, MARTINEZ, HERNANDEZ etc. that appear on
 * source-year properties with no counterpart in the year being filled, and
 * that have not been used as a search term in any prior scrape.
 *
 * Usage: TCAD_YEAR=2026 doppler run -- npx tsx scripts/backfill-novel.ts
 */

import { runBackfillMain } from "./lib/backfill-runner";
import {
	buildPrefixIndex,
	createTermCollector,
	resolveSourceYear,
} from "./lib/backfill-utils";
import {
	mineDescriptionFirstWords,
	mineOwnerFirstWords,
	mineStreetNames,
	mineTwoWordOwnerNames,
} from "./lib/mine-year-terms";
import { getSearchedTermSets } from "./lib/searched-terms";

const MAX_CONSECUTIVE_ZERO_BATCHES = 5;
const MIN_PROPS_PER_TERM = 10;

interface CandidateTerm {
	term: string;
	yield: number;
	source: string;
}

async function getNovelTerms(targetYear: number): Promise<string[]> {
	const sourceYear = await resolveSourceYear(targetYear);
	if (sourceYear === null) {
		console.log(
			`  No other tax year in D1 to mine the gap from — nothing to do.`,
		);
		return [];
	}
	console.log(`  Mining gap: ${sourceYear} → ${targetYear}`);

	const { allSearched: searched } = await getSearchedTermSets(targetYear);
	console.log(`  Already-searched terms: ${searched.size}`);

	// Collect all candidates with their yields from all sources
	const candidates: CandidateTerm[] = [];

	const mineOpts = {
		sourceYear,
		targetYear,
		minCount: MIN_PROPS_PER_TERM,
		alphaOnly: true,
	};

	// ── Source 1: Owner first-words from gap properties ────────────────
	console.log("  Mining owner first-words from gap properties...");
	const firstWords = await mineOwnerFirstWords(mineOpts);
	for (const w of firstWords)
		candidates.push({ term: w.term, yield: w.count, source: "owner" });
	console.log(`    First-words mined: ${firstWords.length}`);

	// ── Source 2: Street names from gap properties ─────────────────────
	console.log("  Mining street names from gap properties...");
	const streets = await mineStreetNames(mineOpts);
	for (const s of streets)
		candidates.push({ term: s.term, yield: s.count, source: "street" });
	console.log(`    Street names mined: ${streets.length}`);

	// ── Source 3: Description first-words from gap properties ──────────
	console.log("  Mining description keywords...");
	const descs = await mineDescriptionFirstWords(mineOpts);
	for (const d of descs)
		candidates.push({ term: d.term, yield: d.count, source: "desc" });
	console.log(`    Description keywords mined: ${descs.length}`);

	// ── Source 4: Two-word owner names from gap properties ─────────────
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
	// supersetsOf is unused (empty) here: novel-term mining needs the OPPOSITE
	// check — skip a candidate that is a prefix of an already-searched term,
	// not one that extends it — handled separately below via searchedPrefixes.
	const { addTerm, result, stats } = createTermCollector({
		excluded: [searched],
		supersetsOf: new Set(),
	});
	let skippedPrefix = 0;

	for (const c of candidates) {
		const lower = c.term.toLowerCase();
		// Skip if this term is a prefix of an already-searched longer term
		// e.g. "fort" skipped because "fortenberry" was already searched
		if (searchedPrefixes.has(lower)) {
			skippedPrefix++;
			continue;
		}
		addTerm(c.term);
	}

	console.log(
		`  Skipped: ${stats.excluded} already-searched/dupes, ${skippedPrefix} prefix-of-searched`,
	);
	console.log(`  Final novel terms: ${result.length}`);
	return result;
}

runBackfillMain({
	getTerms: getNovelTerms,
	label: "Novel Owner Names",
	maxConsecutiveZeroBatches: MAX_CONSECUTIVE_ZERO_BATCHES,
});
