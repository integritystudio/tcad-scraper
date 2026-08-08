/** Shared helpers for the backfill scripts. */

import { DEFAULT_TCAD_YEAR, MIN_TERM_LENGTH } from "../../utils/constants";
import { prisma } from "./d1-prisma";
import type { MinedTerm } from "./mine-year-terms";

/** Count properties scraped for a given tax year. */
export async function getPropertyCount(
	year: number = DEFAULT_TCAD_YEAR,
): Promise<number> {
	const result = await prisma.$queryRaw<[{ count: number }]>`
    SELECT COUNT(*) as count FROM properties WHERE year = ${year}`;
	return Number(result[0].count);
}

/**
 * Pick the year whose properties supply mining vocabulary for a backfill of
 * `targetYear`: the most-populated *other* year in D1.
 *
 * Chosen from the data rather than hardcoded because the relationship
 * reverses each roll season — 2026 seeded 2025's backfill, 2025 now seeds
 * 2026's — and a hardcoded pair silently mines an empty table when it goes
 * stale. Returns null when no other year has been scraped, which callers
 * must treat as "no gap mining available", not as an error.
 */
export async function resolveSourceYear(
	targetYear: number,
): Promise<number | null> {
	const rows = await prisma.$queryRaw<Array<{ year: number; cnt: number }>>`
    SELECT year, COUNT(*) AS cnt
    FROM properties
    WHERE year != ${targetYear}
    GROUP BY year
    ORDER BY cnt DESC
    LIMIT 1`;
	return rows.length > 0 ? Number(rows[0].year) : null;
}

/**
 * Extension filter: true when a shorter prefix (MIN_TERM_LENGTH+ chars) of
 * `lower` is in `terms`. TCAD full-text search is prefix-based, so a term
 * extending one already in the set can only return a subset of its results.
 * Example: skip "JOHNSONVIL" when "JOHNSON" is present. Pass the `successful`
 * set to skip extensions of proven terms, or `allSearched` to skip
 * extensions of anything tried.
 */
export function isSupersetOfAny(lower: string, terms: Set<string>): boolean {
	for (let len = MIN_TERM_LENGTH; len < lower.length; len++) {
		if (terms.has(lower.substring(0, len))) return true;
	}
	return false;
}

/**
 * Index of every MIN_TERM_LENGTH+ proper prefix of the given terms, for O(1)
 * "is this candidate a prefix of something already searched?" checks — the
 * OPPOSITE filter from isSupersetOfAny. Example: with "FORTENBERRY" searched,
 * the index contains "FORT", so the shorter candidate "FORT" can be skipped
 * when the goal is mining genuinely new owner-name namespaces
 * (backfill-2025-novel) rather than extending already-explored ones.
 */
export function buildPrefixIndex(terms: Set<string>): Set<string> {
	const prefixes = new Set<string>();
	for (const term of terms) {
		for (let len = MIN_TERM_LENGTH; len < term.length; len++) {
			prefixes.add(term.substring(0, len));
		}
	}
	return prefixes;
}

export interface TermCollectorOptions {
	/** Term is rejected if its lowercased form is in any of these sets. */
	excluded: Set<string>[];
	/** Term is rejected if it extends a term in this set — see isSupersetOfAny. */
	supersetsOf: Set<string>;
}

export interface TermCollector {
	/** Add a candidate term; returns true if accepted (unique, long enough, not excluded/superset). */
	addTerm: (term: string) => boolean;
	/** Accepted terms, in insertion order. */
	result: string[];
	/** Rejection counts, for progress logging. */
	stats: { excluded: number; superset: number };
}

/**
 * Shared collector for the backfill-2025* / enqueue-tail-terms term-selection
 * loops: dedupes against terms already added this run, filters anything in
 * `excluded`, and drops extensions of proven terms via isSupersetOfAny.
 */
export function createTermCollector(opts: TermCollectorOptions): TermCollector {
	const seen = new Set<string>();
	const result: string[] = [];
	const stats = { excluded: 0, superset: 0 };

	function addTerm(term: string): boolean {
		if (term.length < MIN_TERM_LENGTH) return false;
		const lower = term.toLowerCase();
		if (seen.has(lower) || opts.excluded.some((set) => set.has(lower))) {
			stats.excluded++;
			return false;
		}
		if (isSupersetOfAny(lower, opts.supersetsOf)) {
			stats.superset++;
			return false;
		}
		seen.add(lower);
		result.push(term);
		return true;
	}

	return { addTerm, result, stats };
}

/**
 * Runs a mine-year-terms query, adds each result's term to the collector,
 * and logs the source label plus how many terms it contributed. Shared by
 * enqueue-tail-terms and backfill-unsearched, which each mine several
 * year-gap sources per run.
 */
export async function mineAndAdd(
	collector: TermCollector,
	label: string,
	miner: () => Promise<MinedTerm[]>,
): Promise<void> {
	console.log(`  Mining ${label}...`);
	const before = collector.result.length;
	for (const { term } of await miner()) collector.addTerm(term);
	console.log(`    ${label} added: ${collector.result.length - before}`);
}
