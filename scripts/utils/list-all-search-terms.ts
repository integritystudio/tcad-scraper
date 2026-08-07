/**
 * Deduplicated inventory of all non-numeric search terms across
 * config/batch-configs.ts, lib/curated-names.ts, and lib/fallback-terms.ts.
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
import { FALLBACK_TERMS } from "../lib/fallback-terms";

const NUMERIC_ONLY = /^\d+$/;

function sortInsensitive(a: string, b: string): number {
	return a.localeCompare(b, undefined, { sensitivity: "base" });
}

export interface SearchTermInventory {
	/** All unique non-numeric terms across every source (case-sensitive dedup) */
	all: string[];
	/** Per-source breakdown; each term appears in exactly one bucket (first source wins) */
	sources: Record<string, string[]>;
	/**
	 * Terms that appear in more than one source, formatted "term [source ∩ firstSource]".
	 * Unlike list-curated-terms.ts's duplicated bucket, this one is not expected
	 * to be empty — curated-names.ts and fallback-terms.ts/batch-configs.ts are
	 * independently curated pools that legitimately overlap; this surfaces that
	 * overlap rather than enforcing disjointness.
	 */
	duplicated: string[];
}

/** Collect and deduplicate all non-numeric search terms from every source. */
export function getAllSearchTerms(): SearchTermInventory {
	// Source 1: batch-configs.ts (includes HIGH_RESULT_TERM_SPLITS)
	const batchTerms = new Set<string>();
	for (const config of Object.values(BATCH_CONFIGS)) {
		for (const term of config.terms) {
			if (!NUMERIC_ONLY.test(term)) batchTerms.add(term);
		}
	}
	for (const splits of HIGH_RESULT_TERM_SPLITS.values()) {
		for (const term of splits) {
			if (!NUMERIC_ONLY.test(term)) batchTerms.add(term);
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
			if (!NUMERIC_ONLY.test(term)) curatedNamesTerms.add(term);
		}
	}

	// Source 3: lib/fallback-terms.ts
	const fallbackTerms = new Set<string>();
	for (const term of FALLBACK_TERMS) {
		if (!NUMERIC_ONLY.test(term)) fallbackTerms.add(term);
	}

	// Priority order: batch-configs > curated-names > fallback-terms
	const rawSources: Record<string, Set<string>> = {
		"batch-configs": batchTerms,
		"curated-names": curatedNamesTerms,
		"fallback-terms": fallbackTerms,
	};

	const seenLower = new Map<string, string>(); // lower → first source name
	const duplicated: string[] = [];
	const sources: Record<string, string[]> = {};

	for (const [name, terms] of Object.entries(rawSources)) {
		sources[name] = [];
		for (const term of terms) {
			const lower = term.toLowerCase();
			const firstSeen = seenLower.get(lower);
			if (firstSeen !== undefined) {
				duplicated.push(`${term} [${name} ∩ ${firstSeen}]`);
			} else {
				seenLower.set(lower, name);
				sources[name].push(term);
			}
		}
		sources[name].sort(sortInsensitive);
	}

	const all = Object.values(sources).flat().sort(sortInsensitive);

	return { all, sources, duplicated: duplicated.sort(sortInsensitive) };
}

// --- CLI output ---

function printRows(terms: string[], indent = "  ", perRow = 10): void {
	for (let i = 0; i < terms.length; i += perRow) {
		console.log(indent + terms.slice(i, i + perRow).join(", "));
	}
}

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
		printRows(terms);
		console.log();
	}

	if (duplicated.length > 0) {
		console.log(`--- duplicated across sources (${duplicated.length}) ---`);
		printRows(duplicated);
		console.log();
	}

	console.log(`=== FULL DEDUPED LIST (${all.length}) ===`);
	printRows(all, "", 10);
}
