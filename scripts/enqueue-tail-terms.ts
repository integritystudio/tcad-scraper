/**
 * Enqueue "tail" search terms to maximize new property discovery once
 * high-yield terms have been exhausted.
 *
 * Three phases, each ordered by expected yield:
 *   Phase 1: Unscrapped analytics terms (proven yielders not yet searched for the target year)
 *   Phase 2: Analytics tail terms ranked by total_results DESC (diminishing returns)
 *   Phase 3: Owner-name mining from the year gap (novel terms)
 *
 * Uses the backfill-runner loop with adaptive zero-batch cutoff (default 5).
 *
 * Usage: TCAD_YEAR=2026 doppler run -- npx tsx scripts/enqueue-tail-terms.ts
 *        TCAD_YEAR=2026 doppler run -- npx tsx scripts/enqueue-tail-terms.ts --phase 2
 */

import { runBackfillMain } from "./lib/backfill-runner";
import {
	createTermCollector,
	mineAndAdd,
	resolveSourceYear,
} from "./lib/backfill-utils";
import { prisma } from "./lib/d1-prisma";
import { mineOwnerFirstWords, mineStreetNames } from "./lib/mine-year-terms";
import { getSearchedTermSets } from "./lib/searched-terms";

const MAX_CONSECUTIVE_ZERO_BATCHES = 5;
const MIN_PROPS_PER_TERM = 5;

/** All analytics terms that ever yielded results, ordered by total_results DESC. */
async function fetchAnalyticsTermsByYield(): Promise<string[]> {
	const rows = await prisma.$queryRaw<
		Array<{ search_term: string; total_results: number }>
	>`
		SELECT search_term, total_results
		FROM search_term_analytics
		WHERE total_results > 0
		ORDER BY total_results DESC`;
	return rows.map((r) => r.search_term);
}

/** Parse --phase flag (1, 2, or 3). Default: run all phases sequentially. */
function parsePhaseArg(): number | null {
	const idx = process.argv.indexOf("--phase");
	if (idx === -1 || idx + 1 >= process.argv.length) return null;
	const val = parseInt(process.argv[idx + 1], 10);
	return val >= 1 && val <= 3 ? val : null;
}

async function getTailTerms(targetYear: number): Promise<string[]> {
	const { searchedForYear, successful } = await getSearchedTermSets(targetYear);
	const collector = createTermCollector({
		excluded: [searchedForYear],
		supersetsOf: successful,
	});
	const { addTerm, result, stats } = collector;

	const phase = parsePhaseArg();
	const runPhase3 = phase === null || phase === 3;

	// ── Phases 1 & 2: analytics terms by total_results DESC ───────────
	// Both phases run the same query — Phase 1 already adds every yielding
	// analytics term in tail order, so Phase 2 only runs standalone when
	// --phase 2 is passed (the flag exists to target either label).
	if (phase === null || phase === 1 || phase === 2) {
		const prevCount = result.length;
		console.log(
			phase === 2
				? "  Phase 2: Analytics tail terms..."
				: "  Phase 1: Unscrapped analytics terms (proven yielders)...",
		);
		for (const term of await fetchAnalyticsTermsByYield()) addTerm(term);
		console.log(`    Added: ${result.length - prevCount} terms`);
	}

	// ── Phase 3: Owner-name mining from the year gap ──────────────────
	if (runPhase3) {
		const sourceYear = await resolveSourceYear(targetYear);
		if (sourceYear === null) {
			console.log("  Phase 3: skipped — no other tax year in D1 to mine.");
		} else {
			console.log(
				`  Phase 3: Mining owner names from the ${sourceYear} → ${targetYear} gap...`,
			);
			// excludeAllNumeric: mined street numbers and numeric entity names
			// ('1905', '4229') cannot be searched as bare terms, so enqueuing them
			// only burns jobs.
			const years = { sourceYear, targetYear, excludeAllNumeric: true };
			await mineAndAdd(collector, "owner first-words", () =>
				mineOwnerFirstWords({ ...years, minCount: MIN_PROPS_PER_TERM }),
			);
			await mineAndAdd(collector, "street names", () =>
				mineStreetNames({ ...years, minCount: MIN_PROPS_PER_TERM }),
			);
		}
	}

	console.log(
		`\n  Summary: ${result.length} terms | skipped ${stats.excluded} already-searched, ${stats.superset} supersets`,
	);
	return result;
}

const phase = parsePhaseArg();
const label = phase ? `Tail Terms (Phase ${phase})` : "Tail Terms (All Phases)";

runBackfillMain({
	getTerms: getTailTerms,
	label,
	maxConsecutiveZeroBatches: MAX_CONSECUTIVE_ZERO_BATCHES,
});
