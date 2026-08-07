/**
 * Backfill 2025 TCAD properties by enqueuing high-yield terms
 * that exist in 2026 data but not yet in 2025.
 *
 * Usage: TCAD_YEAR=2025 doppler run -- npx tsx scripts/backfill-2025.ts
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
import { createTermCollector } from "./lib/backfill-utils";
import { prisma } from "./lib/d1-prisma";
import { getSearchedTermSets } from "./lib/searched-terms";

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
		for (const ch of ALPHABET) {
			const expanded = row.searchTerm + ch;
			const lower = expanded.toLowerCase();
			if (
				expanded.length < MIN_TERM_LENGTH ||
				allSearched.has(lower) ||
				seen.has(lower)
			)
				continue;
			seen.add(lower);
			expansions.push(expanded);
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

async function getTermsToBackfill(): Promise<string[]> {
	const { searched2025, allSearched, successful } = await getSearchedTermSets();

	// Source 1: High-yield 2026 terms not yet in 2025
	const terms2026 = await prisma.$queryRaw<
		Array<{ search_term: string; cnt: number }>
	>`
    SELECT search_term, COUNT(*) as cnt
    FROM properties
    WHERE year = 2026
    GROUP BY search_term
    ORDER BY cnt DESC
    LIMIT 300`;

	// Source 2: High-yield analytics terms
	const analytics = await prisma.searchTermAnalytics.findMany({
		where: { totalResults: { gt: 500 } },
		orderBy: { totalResults: "desc" },
		select: { searchTerm: true, totalResults: true },
	});

	// Source 3: Dense term prefix expansions
	const denseExpansions = await getDenseExpansions(allSearched);

	// Source 4: Analytics seed prefix expansions
	const seedExpansions = await getSeedExpansions(allSearched);

	const { addTerm, result } = createTermCollector({
		excluded: [searched2025],
		supersetsOf: successful,
	});

	// Priority: proven 2026 > analytics > STATIC FULL TERMS > dense > seed expansions
	for (const r of terms2026) addTerm(r.search_term);
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
