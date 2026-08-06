/**
 * Enqueue "tail" search terms to maximize new property discovery once
 * high-yield terms have been exhausted.
 *
 * Three phases, each ordered by expected yield:
 *   Phase 1: Unscrapped analytics terms (proven yielders not yet searched for 2025)
 *   Phase 2: Analytics tail terms ranked by total_results DESC (diminishing returns)
 *   Phase 3: Owner-name mining from 2026-only properties (novel terms)
 *
 * Uses the backfill-runner loop with adaptive zero-batch cutoff (default 5).
 *
 * Usage: TCAD_YEAR=2025 doppler run -- npx tsx scripts/enqueue-tail-terms.ts
 *        TCAD_YEAR=2025 doppler run -- npx tsx scripts/enqueue-tail-terms.ts --phase 2
 */

import { MIN_TERM_LENGTH } from "../utils/constants";
import { runBackfillMain } from "./lib/backfill-runner";
import { isSupersetOfSuccessful } from "./lib/backfill-utils";
import { prisma } from "./lib/d1-prisma";
import { mineOwnerFirstWords, mineStreetNames } from "./lib/mine-2026-terms";
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

async function getTailTerms(): Promise<string[]> {
	const { searched2025, successful } = await getSearchedTermSets();
	const seen = new Set<string>();
	const result: string[] = [];
	let skippedSearched = 0;
	let skippedSupersets = 0;

	function addTerm(term: string): boolean {
		if (term.length < MIN_TERM_LENGTH) return false;
		const lower = term.toLowerCase();
		if (searched2025.has(lower) || seen.has(lower)) {
			skippedSearched++;
			return false;
		}
		if (isSupersetOfSuccessful(lower, successful)) {
			skippedSupersets++;
			return false;
		}
		seen.add(lower);
		result.push(term);
		return true;
	}

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

	// ── Phase 3: Owner-name mining from 2026-only properties ──────────
	if (runPhase3) {
		const prevCount = result.length;
		console.log("  Phase 3: Mining owner names from 2026-only properties...");

		// First words of owner names on 2026 properties missing from 2025
		const ownerNames = await mineOwnerFirstWords({
			minCount: MIN_PROPS_PER_TERM,
		});
		for (const row of ownerNames) addTerm(row.term);

		// Street names from 2026-only properties
		const streets = await mineStreetNames({ minCount: MIN_PROPS_PER_TERM });
		for (const row of streets) addTerm(row.term);
		console.log(`    Added: ${result.length - prevCount} terms`);
	}

	console.log(
		`\n  Summary: ${result.length} terms | skipped ${skippedSearched} already-searched, ${skippedSupersets} supersets`,
	);
	return result;
}

const phase = parsePhaseArg();
const label = phase ? `Tail Terms (Phase ${phase})` : "Tail Terms (All Phases)";

runBackfillMain({
	getTerms: getTailTerms,
	userId: "tail-term-optimizer",
	label,
	maxConsecutiveZeroBatches: MAX_CONSECUTIVE_ZERO_BATCHES,
});
