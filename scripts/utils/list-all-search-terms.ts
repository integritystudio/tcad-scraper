/**
 * Deduplicated inventory of all non-numeric search terms across
 * config/batch-configs.ts and lib/curated-names.ts.
 *
 * Importable: `import { getAllSearchTerms } from "./utils/list-all-search-terms"`
 * CLI:        `npx tsx scripts/utils/list-all-search-terms.ts`
 */

import { pathToFileURL } from "node:url";
import {
	BATCH_CONFIGS,
	HIGH_RESULT_TERM_SPLITS,
} from "../config/batch-configs";
import {
	BUSINESS_ENTITY,
	FIRST_NAMES_FEMALE,
	FIRST_NAMES_MALE,
	LAST_NAMES,
	STREET_GEOGRAPHIC,
} from "../lib/curated-names";
import {
	buildTermInventory,
	printTermRows,
	type TermInventory,
} from "../lib/term-inventory";

export type SearchTermInventory = TermInventory;

/** Collect and deduplicate all non-numeric search terms from every source. */
export function getAllSearchTerms(): SearchTermInventory {
	// Source 1: batch-configs.ts (includes HIGH_RESULT_TERM_SPLITS)
	const batchTerms = new Set<string>();
	for (const config of Object.values(BATCH_CONFIGS)) {
		for (const term of config.terms) {
			batchTerms.add(term);
		}
	}
	for (const splits of HIGH_RESULT_TERM_SPLITS.values()) {
		for (const term of splits) {
			batchTerms.add(term);
		}
	}

	// Source 2: lib/curated-names.ts (real first/last names, geo, entity words —
	// the canonical data generate-next-200-terms.ts also draws from)
	const curatedNamesTerms = new Set<string>();
	for (const list of [
		FIRST_NAMES_FEMALE,
		FIRST_NAMES_MALE,
		LAST_NAMES,
		STREET_GEOGRAPHIC,
		BUSINESS_ENTITY,
	]) {
		for (const term of list) {
			curatedNamesTerms.add(term);
		}
	}

	// Priority order: batch-configs > curated-names.
	// Terms that overlap across these independently curated pools are not an
	// error (unlike list-curated-terms.ts) — buildTermInventory's `duplicated`
	// bucket just surfaces the overlap rather than enforcing disjointness.
	return buildTermInventory({
		"batch-configs": batchTerms,
		"curated-names": curatedNamesTerms,
	});
}

// --- CLI output ---

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	const { all, sources, duplicated } = getAllSearchTerms();

	console.log("=== SEARCH TERM INVENTORY (DEDUPED) ===\n");
	console.log(`Total unique non-numeric terms: ${all.length}`);
	for (const [name, terms] of Object.entries(sources)) {
		console.log(`  ${name}: ${terms.length}`);
	}
	console.log(`  duplicated: ${duplicated.length}\n`);

	for (const [name, terms] of Object.entries(sources)) {
		console.log(`--- ${name} (${terms.length}) ---`);
		printTermRows(terms, "  ", 10);
		console.log();
	}

	if (duplicated.length > 0) {
		console.log(`--- duplicated across sources (${duplicated.length}) ---`);
		printTermRows(duplicated, "  ", 10);
		console.log();
	}

	console.log(`=== FULL DEDUPED LIST (${all.length}) ===`);
	printTermRows(all, "", 10);
}
