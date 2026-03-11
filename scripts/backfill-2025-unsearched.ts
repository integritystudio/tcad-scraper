/**
 * Backfill 2025 TCAD properties using unsearched name/address patterns
 * mined from 2026-only properties (property_ids in 2026 but not 2025).
 *
 * Strategy: extract owner names, entity names, and street names from
 * 2026 properties that have no 2025 counterpart, filter supersets and
 * already-searched terms, then enqueue in batches with drain-and-count.
 *
 * Usage: TCAD_YEAR=2025 doppler run -- npx tsx scripts/backfill-2025-unsearched.ts
 */

import { prisma } from "../server/src/lib/prisma";
import { MIN_TERM_LENGTH } from "../utils/constants";
import { runBackfillMain } from "./lib/backfill-runner";
import { isSupersetOfSuccessful } from "./lib/backfill-utils";
import { getSearchedTermSets } from "./lib/searched-terms";

async function getUnsearchedTerms(): Promise<string[]> {
	const {
		allSearched: searched,
		successful,
		searched2025,
	} = await getSearchedTermSets();
	const seen = new Set<string>();
	const result: string[] = [];
	let skippedSupersets = 0;
	let skippedSearched = 0;

	function addTerm(term: string): boolean {
		if (term.length < MIN_TERM_LENGTH) return false;
		const lower = term.toLowerCase();
		if (searched.has(lower) || searched2025.has(lower) || seen.has(lower)) {
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

	// ── Source 1: Owner first-words from 2026-only properties ──────────
	console.log("  Mining owner first-words from 2026-only properties...");
	const firstWords = await prisma.$queryRaw<
		Array<{ word: string; cnt: number }>
	>`
    SELECT SPLIT_PART(p.name, ' ', 1) as word, COUNT(DISTINCT p.property_id)::int as cnt
    FROM properties p
    WHERE p.year = 2026
    AND p.property_id NOT IN (SELECT property_id FROM properties WHERE year = 2025)
    AND LENGTH(SPLIT_PART(p.name, ' ', 1)) >= ${MIN_TERM_LENGTH}
    GROUP BY SPLIT_PART(p.name, ' ', 1)
    HAVING COUNT(DISTINCT p.property_id) >= 5
    ORDER BY cnt DESC`;
	for (const w of firstWords) addTerm(w.word);
	console.log(`    First-words added: ${result.length}`);

	// ── Source 2: Entity two-word phrases ──────────────────────────────
	const prevCount = result.length;
	console.log("  Mining entity two-word phrases...");
	const twoWords = await prisma.$queryRaw<
		Array<{ phrase: string; cnt: number }>
	>`
    SELECT CONCAT(SPLIT_PART(p.name, ' ', 1), ' ', SPLIT_PART(p.name, ' ', 2)) as phrase,
           COUNT(DISTINCT p.property_id)::int as cnt
    FROM properties p
    WHERE p.year = 2026
    AND p.property_id NOT IN (SELECT property_id FROM properties WHERE year = 2025)
    AND (p.name LIKE '%LLC%' OR p.name LIKE '%INC%' OR p.name LIKE '%LP%'
         OR p.name LIKE '%LTD%' OR p.name LIKE '%TRUST%')
    GROUP BY phrase
    HAVING COUNT(DISTINCT p.property_id) >= 10
    ORDER BY cnt DESC`;
	for (const t of twoWords) addTerm(t.phrase);
	console.log(`    Entity phrases added: ${result.length - prevCount}`);

	// ── Source 3: Street names from 2026-only properties ───────────────
	const prevCount2 = result.length;
	console.log("  Mining street names...");
	const streets = await prisma.$queryRaw<
		Array<{ street: string; cnt: number }>
	>`
    SELECT SPLIT_PART(property_address, ' ', 2) as street,
           COUNT(DISTINCT property_id)::int as cnt
    FROM properties
    WHERE year = 2026
    AND property_id NOT IN (SELECT property_id FROM properties WHERE year = 2025)
    AND property_address IS NOT NULL
    AND LENGTH(SPLIT_PART(property_address, ' ', 2)) >= ${MIN_TERM_LENGTH}
    GROUP BY SPLIT_PART(property_address, ' ', 2)
    HAVING COUNT(DISTINCT property_id) >= 5
    ORDER BY cnt DESC`;
	for (const s of streets) addTerm(s.street);
	console.log(`    Street names added: ${result.length - prevCount2}`);

	// ── Source 4: Full owner names (first + second word) for all 2026-only ─
	const prevCount3 = result.length;
	console.log("  Mining full owner names (two-word, non-entity)...");
	const fullNames = await prisma.$queryRaw<
		Array<{ phrase: string; cnt: number }>
	>`
    SELECT CONCAT(SPLIT_PART(p.name, ' ', 1), ' ', SPLIT_PART(p.name, ' ', 2)) as phrase,
           COUNT(DISTINCT p.property_id)::int as cnt
    FROM properties p
    WHERE p.year = 2026
    AND p.property_id NOT IN (SELECT property_id FROM properties WHERE year = 2025)
    AND LENGTH(SPLIT_PART(p.name, ' ', 1)) >= ${MIN_TERM_LENGTH}
    AND LENGTH(SPLIT_PART(p.name, ' ', 2)) >= 2
    GROUP BY phrase
    HAVING COUNT(DISTINCT p.property_id) >= 5
    ORDER BY cnt DESC`;
	for (const n of fullNames) addTerm(n.phrase);
	console.log(`    Full names added: ${result.length - prevCount3}`);

	// ── Source 5: Description first-words from 2026-only properties ────
	const prevCount4 = result.length;
	console.log("  Mining description keywords...");
	const descriptions = await prisma.$queryRaw<
		Array<{ word: string; cnt: number }>
	>`
    SELECT SPLIT_PART(p.description, ' ', 1) as word, COUNT(DISTINCT p.property_id)::int as cnt
    FROM properties p
    WHERE p.year = 2026
    AND p.property_id NOT IN (SELECT property_id FROM properties WHERE year = 2025)
    AND p.description IS NOT NULL
    AND LENGTH(SPLIT_PART(p.description, ' ', 1)) >= ${MIN_TERM_LENGTH}
    GROUP BY SPLIT_PART(p.description, ' ', 1)
    HAVING COUNT(DISTINCT p.property_id) >= 10
    ORDER BY cnt DESC`;
	for (const d of descriptions) addTerm(d.word);
	console.log(`    Description keywords added: ${result.length - prevCount4}`);

	console.log(
		`\n  Summary: ${result.length} terms | skipped ${skippedSearched} already-searched, ${skippedSupersets} supersets`,
	);
	return result;
}

runBackfillMain({
	getTerms: getUnsearchedTerms,
	userId: "backfill-2025-unsearched",
	label: "Unsearched Patterns",
});
