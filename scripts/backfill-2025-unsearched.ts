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

import { runBackfillMain } from "./lib/backfill-runner";
import { createTermCollector, mineAndAdd } from "./lib/backfill-utils";
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
	const collector = createTermCollector({
		excluded: [searched, searched2025],
		supersetsOf: successful,
	});
	const { result, stats } = collector;

	await mineAndAdd(collector, "owner first-words", () =>
		mineOwnerFirstWords({ minCount: MIN_PROPS_PER_TERM }),
	);
	await mineAndAdd(collector, "entity two-word phrases", () =>
		mineEntityPhrases({ minCount: MIN_PROPS_PER_NOISY_TERM }),
	);
	await mineAndAdd(collector, "street names", () =>
		mineStreetNames({ minCount: MIN_PROPS_PER_TERM }),
	);
	await mineAndAdd(collector, "full owner names (two-word, non-entity)", () =>
		mineTwoWordOwnerNames({ minCount: MIN_PROPS_PER_TERM }),
	);
	await mineAndAdd(collector, "description keywords", () =>
		mineDescriptionFirstWords({ minCount: MIN_PROPS_PER_NOISY_TERM }),
	);

	console.log(
		`\n  Summary: ${result.length} terms | skipped ${stats.excluded} already-searched, ${stats.superset} supersets`,
	);
	return result;
}

runBackfillMain({
	getTerms: getUnsearchedTerms,
	label: "Unsearched Patterns",
});
