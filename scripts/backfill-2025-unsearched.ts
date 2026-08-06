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

import { MIN_TERM_LENGTH } from "../utils/constants";
import { runBackfillMain } from "./lib/backfill-runner";
import { isSupersetOfSuccessful } from "./lib/backfill-utils";
import { prisma } from "./lib/d1-prisma";
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
    WITH words AS (
      SELECT property_id, substr(name, 1, instr(name || ' ', ' ') - 1) AS word
      FROM properties
      WHERE year = 2026
      AND property_id NOT IN (SELECT property_id FROM properties WHERE year = 2025)
    )
    SELECT word, COUNT(DISTINCT property_id) as cnt
    FROM words
    WHERE LENGTH(word) >= ${MIN_TERM_LENGTH}
    GROUP BY word
    HAVING COUNT(DISTINCT property_id) >= 5
    ORDER BY cnt DESC`;
	for (const w of firstWords) addTerm(w.word);
	console.log(`    First-words added: ${result.length}`);

	// ── Source 2: Entity two-word phrases ──────────────────────────────
	const prevCount = result.length;
	console.log("  Mining entity two-word phrases...");
	const twoWords = await prisma.$queryRaw<
		Array<{ phrase: string; cnt: number }>
	>`
    WITH split1 AS (
      SELECT property_id,
             substr(name, 1, instr(name || ' ', ' ') - 1) AS w1,
             substr(name || ' ', instr(name || ' ', ' ') + 1) AS rest
      FROM properties
      WHERE year = 2026
      AND property_id NOT IN (SELECT property_id FROM properties WHERE year = 2025)
      AND (name LIKE '%LLC%' OR name LIKE '%INC%' OR name LIKE '%LP%'
           OR name LIKE '%LTD%' OR name LIKE '%TRUST%')
    )
    SELECT w1 || ' ' || substr(rest, 1, instr(rest || ' ', ' ') - 1) as phrase,
           COUNT(DISTINCT property_id) as cnt
    FROM split1
    GROUP BY phrase
    HAVING COUNT(DISTINCT property_id) >= 10
    ORDER BY cnt DESC`;
	for (const t of twoWords) addTerm(t.phrase);
	console.log(`    Entity phrases added: ${result.length - prevCount}`);

	// ── Source 3: Street names from 2026-only properties ───────────────
	const prevCount2 = result.length;
	console.log("  Mining street names...");
	const streets = await prisma.$queryRaw<
		Array<{ street: string; cnt: number }>
	>`
    WITH rests AS (
      SELECT property_id,
             substr(property_address || ' ', instr(property_address || ' ', ' ') + 1) AS rest
      FROM properties
      WHERE year = 2026
      AND property_id NOT IN (SELECT property_id FROM properties WHERE year = 2025)
      AND property_address IS NOT NULL
    ),
    words AS (
      SELECT property_id, substr(rest, 1, instr(rest || ' ', ' ') - 1) AS street
      FROM rests
    )
    SELECT street, COUNT(DISTINCT property_id) as cnt
    FROM words
    WHERE LENGTH(street) >= ${MIN_TERM_LENGTH}
    GROUP BY street
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
    WITH split1 AS (
      SELECT property_id,
             substr(name, 1, instr(name || ' ', ' ') - 1) AS w1,
             substr(name || ' ', instr(name || ' ', ' ') + 1) AS rest
      FROM properties
      WHERE year = 2026
      AND property_id NOT IN (SELECT property_id FROM properties WHERE year = 2025)
    ),
    split2 AS (
      SELECT property_id, w1, substr(rest, 1, instr(rest || ' ', ' ') - 1) AS w2
      FROM split1
    )
    SELECT w1 || ' ' || w2 as phrase, COUNT(DISTINCT property_id) as cnt
    FROM split2
    WHERE LENGTH(w1) >= ${MIN_TERM_LENGTH} AND LENGTH(w2) >= 2
    GROUP BY phrase
    HAVING COUNT(DISTINCT property_id) >= 5
    ORDER BY cnt DESC`;
	for (const n of fullNames) addTerm(n.phrase);
	console.log(`    Full names added: ${result.length - prevCount3}`);

	// ── Source 5: Description first-words from 2026-only properties ────
	const prevCount4 = result.length;
	console.log("  Mining description keywords...");
	const descriptions = await prisma.$queryRaw<
		Array<{ word: string; cnt: number }>
	>`
    WITH words AS (
      SELECT property_id,
             substr(description, 1, instr(description || ' ', ' ') - 1) AS word
      FROM properties
      WHERE year = 2026
      AND property_id NOT IN (SELECT property_id FROM properties WHERE year = 2025)
      AND description IS NOT NULL
    )
    SELECT word, COUNT(DISTINCT property_id) as cnt
    FROM words
    WHERE LENGTH(word) >= ${MIN_TERM_LENGTH}
    GROUP BY word
    HAVING COUNT(DISTINCT property_id) >= 10
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
