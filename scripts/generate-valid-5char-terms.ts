/**
 * Generate valid 5-letter search terms restricted to real names, companies, and streets.
 *
 * Sources:
 *  1. System dictionary proper nouns (capitalized 5-letter entries)
 *  2. US Census first names (SSA top names, Hispanic/Asian names common in TX)
 *  3. US Census last names (top 1000 + TX-heavy Hispanic/Asian surnames)
 *  4. Street/geographic terms (Austin subdivisions, TX geography, natural features)
 *  5. Business/entity words (common in commercial property owner names)
 *
 * Algorithm:
 *  For each 4-char CVCV base, append a-z → keep only if result is in the name set.
 *  Also directly includes all 5-letter names from the curated lists.
 *  Filters out already-searched and blacklisted terms.
 *
 * Usage: doppler run -- npx tsx scripts/generate-valid-5char-terms.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
	BUSINESS_ENTITY,
	FIRST_NAMES_FEMALE,
	FIRST_NAMES_MALE,
	LAST_NAMES,
	STREET_GEOGRAPHIC,
} from "./lib/curated-names";
import { generateCvcvBases } from "./lib/cvcv";
import { prisma } from "./lib/d1-prisma";
import {
	getBlacklistedTermSet,
	getSearchedTermSets,
} from "./lib/searched-terms";

const OUTPUT_PATH = join(__dirname, "..", "data", "valid-5char-terms.txt");

async function main() {
	// 1. Build the valid name set from all sources
	const validNames = new Set<string>();

	// Dictionary proper nouns skipped for now — most are obscure historical/
	// botanical names that don't match TCAD owners (50% failure rate in testing).
	// TODO: Re-enable dictionary proper nouns when curated name lists are
	// exhausted and we need to cast a wider net for diminishing-return terms.
	//
	// const dictRaw = readFileSync('/usr/share/dict/words', 'utf-8');
	// for (const line of dictRaw.split('\n')) {
	//   const w = line.trim();
	//   if (w.length === 5 && /^[A-Z][a-z]{4}$/.test(w)) {
	//     validNames.add(w.toLowerCase());
	//   }
	// }
	const dictProperCount = 0;

	// Add all curated lists
	const allLists = [
		FIRST_NAMES_FEMALE,
		FIRST_NAMES_MALE,
		LAST_NAMES,
		STREET_GEOGRAPHIC,
		BUSINESS_ENTITY,
	];
	for (const list of allLists) {
		for (const name of list) {
			const lower = name.toLowerCase();
			if (lower.length === 5 && /^[a-z]{5}$/.test(lower)) {
				validNames.add(lower);
			}
		}
	}

	console.error(
		`Valid name set: ${validNames.size} entries (${dictProperCount} from dictionary proper nouns)`,
	);

	// 2. Load already-searched terms from DB
	const { allSearched: searched } = await getSearchedTermSets();

	// Blacklist (zero-yield after repeated searches — hard skip)
	const blacklistSet = await getBlacklistedTermSet();

	console.error(
		`Already searched: ${searched.size} | Blacklisted: ${blacklistSet.size}`,
	);

	// 3. Generate terms: CVCV expansion + direct name inclusion
	const results = new Set<string>();

	// 3a. CVCV base expansion (append a-z, keep if valid name)
	let expansionHits = 0;

	for (const base of generateCvcvBases()) {
		for (let ch = 97; ch <= 122; ch++) {
			const candidate = base + String.fromCharCode(ch);
			if (!validNames.has(candidate)) continue;
			if (searched.has(candidate)) continue;
			if (blacklistSet.has(candidate)) continue;
			results.add(candidate);
			expansionHits++;
		}
	}

	// 3b. Direct inclusion of all valid 5-letter names not yet searched
	let directHits = 0;
	for (const name of validNames) {
		if (searched.has(name)) continue;
		if (blacklistSet.has(name)) continue;
		if (!results.has(name)) {
			results.add(name);
			directHits++;
		}
	}

	// Sort and capitalize for output
	const sorted = [...results]
		.sort()
		.map((t) => t.charAt(0).toUpperCase() + t.slice(1));

	console.error(`CVCV expansions that matched names: ${expansionHits}`);
	console.error(`Direct name inclusions: ${directHits}`);
	console.error(`Total unique terms: ${sorted.length}`);

	// 4. Write output
	mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
	writeFileSync(OUTPUT_PATH, `${sorted.join("\n")}\n`);
	console.error(`Written to: ${OUTPUT_PATH}`);

	// 5. Categorize for summary
	const firstF = new Set(
		FIRST_NAMES_FEMALE.map((n) => n.toLowerCase()).filter(
			(n) => n.length === 5,
		),
	);
	const firstM = new Set(
		FIRST_NAMES_MALE.map((n) => n.toLowerCase()).filter((n) => n.length === 5),
	);
	const lastN = new Set(
		LAST_NAMES.map((n) => n.toLowerCase()).filter((n) => n.length === 5),
	);
	const geo = new Set(
		STREET_GEOGRAPHIC.map((n) => n.toLowerCase()).filter((n) => n.length === 5),
	);
	const biz = new Set(
		BUSINESS_ENTITY.map((n) => n.toLowerCase()).filter((n) => n.length === 5),
	);

	let catFirst = 0,
		catLast = 0,
		catGeo = 0,
		catBiz = 0,
		catDict = 0;
	for (const term of results) {
		if (firstF.has(term) || firstM.has(term)) catFirst++;
		else if (lastN.has(term)) catLast++;
		else if (geo.has(term)) catGeo++;
		else if (biz.has(term)) catBiz++;
		else catDict++;
	}

	console.error(`\nBy category:`);
	console.error(`  First names: ${catFirst}`);
	console.error(`  Last names: ${catLast}`);
	console.error(`  Geographic/street: ${catGeo}`);
	console.error(`  Business/entity: ${catBiz}`);
	console.error(`  Dictionary proper nouns: ${catDict}`);

	// Preview
	console.error(`\nPreview (first 50):`);
	for (const t of sorted.slice(0, 50)) {
		console.error(`  ${t}`);
	}
}

main()
	.catch((err) => {
		console.error(err);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
