/**
 * Backfill a tax year by enqueuing high-yield terms, ordered
 * proven → analytics → static → dense expansions → seed expansions.
 *
 * Usage: TCAD_YEAR=2026 doppler run -- npx tsx scripts/backfill.ts
 */

import {
	ALPHABET,
	DENSE_AVG_RESULTS_THRESHOLD,
	DENSE_MAX_BASE_LENGTH,
	DENSE_MAX_RESULTS_THRESHOLD,
	DENSE_MIN_SUCCESS_RATE,
	MIN_TERM_LENGTH,
	SEED_MIN_AVG_RESULTS,
	SEED_MIN_SUCCESS_RATE,
} from "../utils/constants";
import { BACKFILL_2025_STATIC_TERMS } from "./config/backfill-2025-static-terms";
import { runBackfillMain } from "./lib/backfill-runner";
import { createTermCollector, resolveSourceYear } from "./lib/backfill-utils";
import { prisma } from "./lib/d1-prisma";
import {
	getSearchedTermSets,
	getYearZeroYieldTerms,
} from "./lib/searched-terms";
import { TRUNCATION_BUG_ROOTS } from "./lib/terms/TRUNCATION_BUG_ROOTS";

/** Terms attributed at least this many source-year properties are worth re-running. */
const SOURCE_TERM_LIMIT = 300;
const ANALYTICS_MIN_TOTAL_RESULTS = 500;

async function getDenseExpansions(allSearched: Set<string>): Promise<string[]> {
	const dense = await prisma.searchTermAnalytics.findMany({
		where: {
			OR: [
				{ maxResults: { gte: DENSE_MAX_RESULTS_THRESHOLD } },
				{ avgResultsPerSearch: { gte: DENSE_AVG_RESULTS_THRESHOLD } },
			],
			successRate: { gte: DENSE_MIN_SUCCESS_RATE },
		},
		orderBy: { avgResultsPerSearch: "desc" },
		select: { searchTerm: true },
	});

	const expansions: string[] = [];
	const seen = new Set<string>();
	for (const row of dense) {
		if (row.searchTerm.length > DENSE_MAX_BASE_LENGTH) continue;
		if (TRUNCATION_BUG_ROOTS.has(row.searchTerm.toLowerCase())) continue;
		for (const ch of ALPHABET) {
			const lower = (row.searchTerm + ch).toLowerCase();
			if (
				lower.length < MIN_TERM_LENGTH ||
				allSearched.has(lower) ||
				seen.has(lower)
			)
				continue;
			seen.add(lower);
			expansions.push(lower);
		}
	}
	return expansions;
}

async function getSeedExpansions(allSearched: Set<string>): Promise<string[]> {
	const highYield = await prisma.searchTermAnalytics.findMany({
		where: {
			successRate: { gte: SEED_MIN_SUCCESS_RATE },
			avgResultsPerSearch: { gte: SEED_MIN_AVG_RESULTS },
		},
		orderBy: { avgResultsPerSearch: "desc" },
		select: { searchTerm: true },
	});

	const prefixes = new Set<string>();
	for (const row of highYield) {
		if (row.searchTerm.length >= MIN_TERM_LENGTH) {
			prefixes.add(row.searchTerm.substring(0, MIN_TERM_LENGTH).toLowerCase());
		}
	}

	const expansions: string[] = [];
	const seen = new Set<string>();
	for (const prefix of prefixes) {
		if (TRUNCATION_BUG_ROOTS.has(prefix)) continue;
		for (const ch of ALPHABET) {
			const expanded = prefix + ch;
			if (allSearched.has(expanded) || seen.has(expanded)) continue;
			seen.add(expanded);
			expansions.push(expanded);
		}
	}
	return expansions;
}

// Static high-yield terms — canonical source in config/backfill-2025-static-terms.ts
const STATIC_TERMS = BACKFILL_2025_STATIC_TERMS;

async function getTermsToBackfill(targetYear: number): Promise<string[]> {
	const { searchedForYear, allSearched, successful } =
		await getSearchedTermSets(targetYear);

	// Zero-yield exclusion is scoped to the year being filled. The analytics
	// table's `unsuccessful` set is deliberately NOT used here: it counts new
	// saves across every year at once, so on a fresh roll year it flags the
	// densest, highest-value vocabulary (Maria, Thomas, Paul — thousands of
	// TCAD matches each) as exhausted purely because 2025 had already
	// captured them. See getYearZeroYieldTerms().
	const zeroYield = await getYearZeroYieldTerms(targetYear);

	// Source 1: terms proven on the source year, not yet run for this one
	const sourceYear = await resolveSourceYear(targetYear);
	const sourceTerms = sourceYear
		? await prisma.$queryRaw<Array<{ search_term: string; cnt: number }>>`
        SELECT search_term, COUNT(*) as cnt
        FROM properties
        WHERE year = ${sourceYear}
        GROUP BY search_term
        ORDER BY cnt DESC
        LIMIT ${SOURCE_TERM_LIMIT}`
		: [];
	if (sourceYear) {
		console.log(`  Source year for proven terms: ${sourceYear}`);
	}

	// Source 2: High-yield analytics terms
	const analytics = await prisma.searchTermAnalytics.findMany({
		where: { totalResults: { gt: ANALYTICS_MIN_TOTAL_RESULTS } },
		orderBy: { totalResults: "desc" },
		select: { searchTerm: true, totalResults: true },
	});

	// Source 3: Dense term prefix expansions
	const denseExpansions = await getDenseExpansions(allSearched);

	// Source 4: Analytics seed prefix expansions
	const seedExpansions = await getSeedExpansions(allSearched);

	const { addTerm, result } = createTermCollector({
		excluded: [searchedForYear, zeroYield],
		supersetsOf: successful,
	});

	// Priority: proven source-year > analytics > STATIC FULL TERMS > dense > seed expansions
	for (const r of sourceTerms) addTerm(r.search_term);
	for (const r of analytics) addTerm(r.searchTerm);
	console.log(`  Known high-yield terms: ${result.length}`);
	for (const t of STATIC_TERMS) addTerm(t);
	console.log(`  After static terms: ${result.length}`);
	for (const t of denseExpansions) addTerm(t);
	console.log(`  After dense expansions: ${result.length}`);
	for (const t of seedExpansions) addTerm(t);
	console.log(`  After seed expansions: ${result.length}`);

	return result;
}

runBackfillMain({
	getTerms: getTermsToBackfill,
	label: "High-Yield Terms",
});
