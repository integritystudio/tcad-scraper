/** Shared helpers for backfill-2025* scripts. */

import { MIN_TERM_LENGTH } from "../../utils/constants";
import { prisma } from "./d1-prisma";

/** Count properties scraped for year 2025. */
export async function get2025Count(): Promise<number> {
	const result = await prisma.$queryRaw<[{ count: number }]>`
    SELECT COUNT(*) as count FROM properties WHERE year = 2025`;
	return result[0].count;
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
