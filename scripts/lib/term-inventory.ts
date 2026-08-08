/**
 * Shared dedupe-by-source algorithm behind utils/list-all-search-terms.ts
 * and utils/list-curated-terms.ts: fold named term lists into one
 * case-insensitive, non-numeric inventory, first source wins ties.
 */

const NUMERIC_ONLY = /^\d+$/;

export function sortInsensitive(a: string, b: string): number {
	return a.localeCompare(b, undefined, { sensitivity: "base" });
}

export interface TermInventory {
	/** All unique non-numeric terms across every source, sorted */
	all: string[];
	/** Per-source breakdown; each term appears in exactly one bucket (first source wins), sorted */
	sources: Record<string, string[]>;
	/**
	 * Terms that appear in more than one source, formatted "term [source ∩ firstSource]", sorted.
	 * Uses the losing occurrence's own casing, not the winning term's — the winner
	 * (stored in `sources`) keeps whatever casing the first source used.
	 */
	duplicated: string[];
}

/**
 * Dedupe non-numeric terms across named source lists, case-insensitively.
 * The first source (in `sources` iteration order) to contain a term wins;
 * later occurrences are recorded in `duplicated` instead of their own bucket.
 */
export function buildTermInventory(
	sources: Record<string, Iterable<string>>,
): TermInventory {
	const seenLower = new Map<string, string>(); // lower → first source name
	const duplicated: string[] = [];
	const result: Record<string, string[]> = {};

	for (const [name, terms] of Object.entries(sources)) {
		result[name] = [];
		for (const term of terms) {
			if (NUMERIC_ONLY.test(term)) continue;
			const lower = term.toLowerCase();
			const firstSeen = seenLower.get(lower);
			if (firstSeen !== undefined) {
				duplicated.push(`${term} [${name} ∩ ${firstSeen}]`);
			} else {
				seenLower.set(lower, name);
				result[name].push(term);
			}
		}
		result[name].sort(sortInsensitive);
	}

	const all = Object.values(result).flat().sort(sortInsensitive);

	return { all, sources: result, duplicated: duplicated.sort(sortInsensitive) };
}

export function printTermRows(
	terms: string[],
	indent = "  ",
	perRow = 8,
): void {
	for (let i = 0; i < terms.length; i += perRow) {
		console.log(indent + terms.slice(i, i + perRow).join(", "));
	}
}

/** Print each source's `--- name (count) ---` header followed by its term rows. */
export function printSourceBreakdown(
	sources: Record<string, string[]>,
	indent?: string,
	perRow?: number,
): void {
	for (const [name, terms] of Object.entries(sources)) {
		console.log(`--- ${name} (${terms.length}) ---`);
		printTermRows(terms, indent, perRow);
		console.log();
	}
}

/** Print the `duplicated` bucket under a labeled header, if non-empty. */
export function printDuplicatesSection(
	duplicated: string[],
	label = "duplicated across sources",
	indent?: string,
	perRow?: number,
): void {
	if (duplicated.length === 0) return;
	console.log(`--- ${label} (${duplicated.length}) ---`);
	printTermRows(duplicated, indent, perRow);
	console.log();
}
