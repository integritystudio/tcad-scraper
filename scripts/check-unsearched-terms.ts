/**
 * Check which inventory terms haven't been searched yet (2025 properties).
 * Uses batched EXISTS queries to avoid full table scans.
 * Usage: doppler run -- npx tsx scripts/check-unsearched-terms.ts
 */
import { prisma } from "./lib/d1-prisma";
import { getAllSearchTerms } from "./utils/list-all-search-terms";

async function check() {
	const allTerms = getAllSearchTerms().all;
	console.log("Total inventory terms:", allTerms.length);

	// Batch EXISTS checks — 50 at a time
	const BATCH = 50;
	const unsearched: string[] = [];
	let checked = 0;

	for (let i = 0; i < allTerms.length; i += BATCH) {
		const batch = allTerms.slice(i, i + BATCH);
		const results = await Promise.all(
			batch.map(async (term) => {
				// SQLite EXISTS returns 0/1, not boolean
				const rows = await prisma.$queryRaw<{ found: number }[]>`
					SELECT EXISTS(SELECT 1 FROM properties WHERE search_term = ${term} AND year = 2025) as found`;
				return { term, found: rows[0].found !== 0 };
			}),
		);
		for (const r of results) {
			if (!r.found) unsearched.push(r.term);
		}
		checked += batch.length;
		if (checked % 100 === 0)
			console.log(`  checked ${checked}/${allTerms.length}...`);
	}

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

check().catch(console.error);
