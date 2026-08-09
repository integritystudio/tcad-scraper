/**
 * Check which inventory terms haven't been searched yet for a tax year.
 * Usage: doppler run -- npx tsx scripts/check-unsearched-terms.ts
 *        TCAD_YEAR=2026 doppler run -- npx tsx scripts/check-unsearched-terms.ts
 */

import { DEFAULT_TCAD_YEAR, MIN_TERM_LENGTH } from "../utils/constants";
import { runMain } from "./lib/run-main";
import { getSearchedTermSets } from "./lib/searched-terms";
import { getAllSearchTerms } from "./utils/list-all-search-terms";

async function check() {
	const year = process.env.TCAD_YEAR
		? parseInt(process.env.TCAD_YEAR, 10)
		: DEFAULT_TCAD_YEAR;
	const allTerms = getAllSearchTerms().all;
	console.log(`Tax year: ${year}`);
	console.log("Total inventory terms:", allTerms.length);

	const { searchedForYear } = await getSearchedTermSets(year);
	const unsearched = allTerms.filter(
		(t) => t.length >= MIN_TERM_LENGTH && !searchedForYear.has(t.toLowerCase()),
	);

	console.log("Searched:", allTerms.length - unsearched.length);
	console.log("Unsearched:", unsearched.length);
	if (unsearched.length > 0) {
		console.log("\nUnsearched terms:");
		for (const t of unsearched) {
			console.log(" ", t);
		}
	} else {
		console.log(`\nAll inventory terms have been searched for ${year}.`);
	}
}

runMain(check);
