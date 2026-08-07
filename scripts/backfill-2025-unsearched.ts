/**
 * Backfill 2025 TCAD properties using unsearched name/address patterns
 * mined from 2026-only properties (property_ids in 2026 but not 2025).
 *
 * Strategy: extract owner names, entity names, and street names from
 * 2026 properties that have no 2025 counterpart, filter supersets and
 * already-searched terms, then enqueue in batches with drain-and-count.
 *
 * Usage: TCAD_YEAR=2025 doppler run -- npx tsx scripts/backfill-2025-unsearched.ts
 */

import { MIN_TERM_LENGTH } from "../utils/constants";
import { runBackfillMain } from "./lib/backfill-runner";
import { isSupersetOfAny } from "./lib/backfill-utils";
import {
	mineDescriptionFirstWords,
	mineEntityPhrases,
	mineOwnerFirstWords,
	mineStreetNames,
	mineTwoWordOwnerNames,
} from "./lib/mine-2026-terms";
import { getSearchedTermSets } from "./lib/searched-terms";

const MIN_PROPS_PER_TERM = 5;
// Entity phrases and description keywords are noisier sources — higher bar.
const MIN_PROPS_PER_NOISY_TERM = 10;

async function getUnsearchedTerms(): Promise<string[]> {
	const {
		allSearched: searched,
		successful,
		searched2025,
	} = await getSearchedTermSets();
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
		if (isSupersetOfAny(lower, successful)) {
			skippedSupersets++;
			return false;
		}
		seen.add(lower);
		result.push(term);
		return true;
	}

	// ── Source 1: Owner first-words from 2026-only properties ──────────
	console.log("  Mining owner first-words from 2026-only properties...");
	const firstWords = await mineOwnerFirstWords({
		minCount: MIN_PROPS_PER_TERM,
	});
	for (const w of firstWords) addTerm(w.term);
	console.log(`    First-words added: ${result.length}`);

	// ── Source 2: Entity two-word phrases ──────────────────────────────
	const prevCount = result.length;
	console.log("  Mining entity two-word phrases...");
	const twoWords = await mineEntityPhrases({
		minCount: MIN_PROPS_PER_NOISY_TERM,
	});
	for (const t of twoWords) addTerm(t.term);
	console.log(`    Entity phrases added: ${result.length - prevCount}`);

	// ── Source 3: Street names from 2026-only properties ───────────────
	const prevCount2 = result.length;
	console.log("  Mining street names...");
	const streets = await mineStreetNames({ minCount: MIN_PROPS_PER_TERM });
	for (const s of streets) addTerm(s.term);
	console.log(`    Street names added: ${result.length - prevCount2}`);

	// ── Source 4: Full owner names (first + second word) for all 2026-only ─
	const prevCount3 = result.length;
	console.log("  Mining full owner names (two-word, non-entity)...");
	const fullNames = await mineTwoWordOwnerNames({
		minCount: MIN_PROPS_PER_TERM,
	});
	for (const n of fullNames) addTerm(n.term);
	console.log(`    Full names added: ${result.length - prevCount3}`);

	// ── Source 5: Description first-words from 2026-only properties ────
	const prevCount4 = result.length;
	console.log("  Mining description keywords...");
	const descriptions = await mineDescriptionFirstWords({
		minCount: MIN_PROPS_PER_NOISY_TERM,
	});
	for (const d of descriptions) addTerm(d.term);
	console.log(`    Description keywords added: ${result.length - prevCount4}`);

	console.log(
		`\n  Summary: ${result.length} terms | skipped ${skippedSearched} already-searched, ${skippedSupersets} supersets`,
	);
	return result;
}

runBackfillMain({
	getTerms: getUnsearchedTerms,
	label: "Unsearched Patterns",
});
