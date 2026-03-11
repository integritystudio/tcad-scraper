/**
 * Deduplicated inventory of all non-numeric search terms across
 * batch-configs.ts and continuous-batch-scraper.ts.
 *
 * Importable: `import { getAllSearchTerms } from "./utils/list-all-search-terms"`
 * CLI:        `npx tsx scripts/utils/list-all-search-terms.ts`
 */

import { BATCH_CONFIGS, HIGH_RESULT_TERM_SPLITS } from "../config/batch-configs";
import { FALLBACK_TERMS } from "../continuous-batch-scraper";

const NUMERIC_ONLY = /^\d+$/;

function sortInsensitive(a: string, b: string): number {
	return a.localeCompare(b, undefined, { sensitivity: "base" });
}

export interface SearchTermInventory {
	/** All unique non-numeric terms (case-sensitive dedup) */
	all: string[];
	/** Terms only in batch-configs.ts */
	batchOnly: string[];
	/** Terms only in continuous-batch-scraper.ts FALLBACK_TERMS */
	fallbackOnly: string[];
	/** Terms present in both files */
	duplicated: string[];
}

/** Collect and deduplicate all non-numeric search terms from both sources. */
export function getAllSearchTerms(): SearchTermInventory {
	// Collect batch-configs terms (includes HIGH_RESULT_TERM_SPLITS)
	const batchSet = new Set<string>();
	for (const config of Object.values(BATCH_CONFIGS)) {
		for (const term of config.terms) {
			if (!NUMERIC_ONLY.test(term)) batchSet.add(term);
		}
	}
	for (const splits of HIGH_RESULT_TERM_SPLITS.values()) {
		for (const term of splits) {
			if (!NUMERIC_ONLY.test(term)) batchSet.add(term);
		}
	}

	// Collect fallback terms, deduped against batch terms (case-insensitive)
	const batchLower = new Set([...batchSet].map((t) => t.toLowerCase()));
	const fallbackSet = new Set<string>();
	for (const term of FALLBACK_TERMS) {
		if (!NUMERIC_ONLY.test(term)) fallbackSet.add(term);
	}

	// Categorize
	const duplicated = [...fallbackSet]
		.filter((t) => batchSet.has(t) || batchLower.has(t.toLowerCase()))
		.sort(sortInsensitive);

	const batchOnly = [...batchSet]
		.filter((t) => !fallbackSet.has(t))
		.sort(sortInsensitive);

	const fallbackOnly = [...fallbackSet]
		.filter((t) => !batchSet.has(t) && !batchLower.has(t.toLowerCase()))
		.sort(sortInsensitive);

	// Combined deduped set (case-insensitive: prefer batch-configs casing)
	const seenLower = new Set<string>();
	const all: string[] = [];
	for (const term of [...batchSet, ...fallbackSet]) {
		if (NUMERIC_ONLY.test(term)) continue;
		const lower = term.toLowerCase();
		if (seenLower.has(lower)) continue;
		seenLower.add(lower);
		all.push(term);
	}
	all.sort(sortInsensitive);

	return { all, batchOnly, fallbackOnly, duplicated };
}

// --- CLI output ---

function printRows(terms: string[], indent = "  ", perRow = 10): void {
	for (let i = 0; i < terms.length; i += perRow) {
		console.log(indent + terms.slice(i, i + perRow).join(", "));
	}
}

if (require.main === module) {
	const { all, batchOnly, fallbackOnly, duplicated } = getAllSearchTerms();

	console.log("=== SEARCH TERM INVENTORY (DEDUPED) ===\n");
	console.log(`Total unique non-numeric terms: ${all.length}`);
	console.log(`  batch-configs only: ${batchOnly.length}`);
	console.log(`  fallback only:      ${fallbackOnly.length}`);
	console.log(`  duplicated:         ${duplicated.length}\n`);

	console.log(`--- batch-configs only (${batchOnly.length}) ---`);
	printRows(batchOnly);
	console.log();

	console.log(`--- fallback only (${fallbackOnly.length}) ---`);
	printRows(fallbackOnly);
	console.log();

	console.log(`--- duplicated across files (${duplicated.length}) ---`);
	printRows(duplicated);
	console.log();

	console.log(`=== FULL DEDUPED LIST (${all.length}) ===`);
	printRows(all, "", 10);
}
