/**
 * Backfill a tax year using unsearched name/address patterns mined from the
 * year gap — property_ids present in the source year but not yet captured
 * for the year being filled.
 *
 * Strategy: extract owner names, entity names, street names and description
 * keywords from gap properties, filter supersets and already-searched terms,
 * then enqueue in batches with drain-and-count.
 *
 * Usage: TCAD_YEAR=2026 doppler run -- npx tsx scripts/backfill-unsearched.ts
 */

import { runBackfillMain } from "./lib/backfill-runner";
import {
	createTermCollector,
	mineAndAdd,
	resolveSourceYear,
} from "./lib/backfill-utils";
import {
	mineDescriptionFirstWords,
	mineEntityPhrases,
	mineOwnerFirstWords,
	mineStreetNames,
	mineTwoWordOwnerNames,
} from "./lib/mine-year-terms";
import { getSearchedTermSets } from "./lib/searched-terms";

const MIN_PROPS_PER_TERM = 5;
// Entity phrases and description keywords are noisier sources — higher bar.
const MIN_PROPS_PER_NOISY_TERM = 10;

async function getUnsearchedTerms(targetYear: number): Promise<string[]> {
	const sourceYear = await resolveSourceYear(targetYear);
	if (sourceYear === null) {
		console.log(
			`  No other tax year in D1 to mine the gap from — nothing to do.`,
		);
		return [];
	}
	console.log(`  Mining gap: ${sourceYear} → ${targetYear}`);

	const {
		allSearched: searched,
		successful,
		searchedForYear,
	} = await getSearchedTermSets(targetYear);
	const collector = createTermCollector({
		excluded: [searched, searchedForYear],
		supersetsOf: successful,
	});
	const { result, stats } = collector;

	const years = { sourceYear, targetYear };

	await mineAndAdd(collector, "owner first-words", () =>
		mineOwnerFirstWords({ ...years, minCount: MIN_PROPS_PER_TERM }),
	);
	await mineAndAdd(collector, "entity two-word phrases", () =>
		mineEntityPhrases({ ...years, minCount: MIN_PROPS_PER_NOISY_TERM }),
	);
	await mineAndAdd(collector, "street names", () =>
		mineStreetNames({ ...years, minCount: MIN_PROPS_PER_TERM }),
	);
	await mineAndAdd(collector, "full owner names (two-word, non-entity)", () =>
		mineTwoWordOwnerNames({ ...years, minCount: MIN_PROPS_PER_TERM }),
	);
	await mineAndAdd(collector, "description keywords", () =>
		mineDescriptionFirstWords({ ...years, minCount: MIN_PROPS_PER_NOISY_TERM }),
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
