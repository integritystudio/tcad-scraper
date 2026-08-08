/**
 * Check which inventory terms haven't been searched yet (2025 properties).
 * Usage: doppler run -- npx tsx scripts/check-unsearched-terms.ts
 */

import { MIN_TERM_LENGTH } from "../utils/constants";
import { runMain } from "./lib/run-main";
import { getSearchedTermSets } from "./lib/searched-terms";
import { getAllSearchTerms } from "./utils/list-all-search-terms";

async function check() {
	const allTerms = getAllSearchTerms().all;
	console.log("Total inventory terms:", allTerms.length);

	const { searched2025 } = await getSearchedTermSets();
	const unsearched = allTerms.filter(
		(t) => t.length >= MIN_TERM_LENGTH && !searched2025.has(t.toLowerCase()),
	);

	console.log("Searched:", allTerms.length - unsearched.length);
	console.log("Unsearched:", unsearched.length);
	if (unsearched.length > 0) {
		console.log("\nUnsearched terms:");
		for (const t of unsearched) {
			console.log(" ", t);
		}
	} else {
		console.log("\nAll inventory terms have been searched for 2025.");
	}
}

runMain(check);
