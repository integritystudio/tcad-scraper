/**
 * Term-mining queries over the *gap* between two tax years — property_ids
 * present in `sourceYear` but absent from `targetYear`. Shared by the
 * backfill scripts and enqueue-tail-terms.ts, which previously each carried
 * their own copies of these CTEs.
 *
 * The direction is a parameter because the gap reverses every roll season.
 * Through August 2026 the scripts mined 2026 → 2025 (2026 was scraped first,
 * 2025 was the gap); the 2026 backfill runs 2025 → 2026. Callers pass both
 * years explicitly, so neither direction is baked into the SQL.
 *
 * Mining a year that is still empty is not a failure mode — an empty
 * `targetYear` makes the NOT IN subquery match nothing, so the candidate pool
 * is every property in `sourceYear`, which is exactly the right starting set.
 * As the target fills, the pool narrows to the remaining gap on its own.
 *
 * Uses $queryRawUnsafe because the filters (years, HAVING threshold, GLOB
 * fragment) vary per caller; every interpolated value is an internal number or
 * fixed SQL fragment — no user input reaches these strings.
 */

import { MIN_TERM_LENGTH } from "../../utils/constants";
import { prisma } from "./d1-prisma";

export interface MinedTerm {
	term: string;
	/** Distinct gap properties (in sourceYear, not in targetYear) matching this term. */
	count: number;
}

export interface YearGap {
	/** Year whose properties supply the candidate vocabulary. */
	sourceYear: number;
	/** Year being filled; its already-captured property_ids are excluded. */
	targetYear: number;
}

export interface MineOptions extends YearGap {
	/** Minimum distinct gap properties per term (HAVING threshold). */
	minCount: number;
	/** Keep only terms starting with a letter (GLOB '[A-Za-z]*'). */
	alphaOnly?: boolean;
}

const ALPHA_GLOB = `GLOB '[A-Za-z]*'`;

const ENTITY_NAME_FILTER = `(name LIKE '%LLC%' OR name LIKE '%INC%' OR name LIKE '%LP%'
         OR name LIKE '%LTD%' OR name LIKE '%TRUST%')`;

/**
 * `FROM properties WHERE <in source year, not yet in target year>`.
 * Years are validated as integers so they can be interpolated safely.
 */
function gapFrom({ sourceYear, targetYear }: YearGap): string {
	for (const [label, year] of [
		["sourceYear", sourceYear],
		["targetYear", targetYear],
	] as const) {
		if (!Number.isInteger(year)) {
			throw new TypeError(`${label} must be an integer, got ${year}`);
		}
	}
	if (sourceYear === targetYear) {
		throw new RangeError(
			`sourceYear and targetYear must differ (both ${sourceYear}) — a year's gap against itself is always empty`,
		);
	}
	return `FROM properties
      WHERE year = ${sourceYear}
      AND property_id NOT IN (SELECT property_id FROM properties WHERE year = ${targetYear})`;
}

async function run(sql: string): Promise<MinedTerm[]> {
	const rows =
		await prisma.$queryRawUnsafe<Array<{ term: string; cnt: number | bigint }>>(
			sql,
		);
	return rows.map((r) => ({ term: r.term, count: Number(r.cnt) }));
}

/** First word of the owner name on gap properties. */
export async function mineOwnerFirstWords(
	opts: MineOptions,
): Promise<MinedTerm[]> {
	return run(`
    WITH words AS (
      SELECT property_id, substr(name, 1, instr(name || ' ', ' ') - 1) AS term
      ${gapFrom(opts)}
    )
    SELECT term, COUNT(DISTINCT property_id) AS cnt
    FROM words
    WHERE LENGTH(term) >= ${MIN_TERM_LENGTH}${opts.alphaOnly ? ` AND term ${ALPHA_GLOB}` : ""}
    GROUP BY term
    HAVING COUNT(DISTINCT property_id) >= ${opts.minCount}
    ORDER BY cnt DESC`);
}

/** Street name (second word of property_address) on gap properties. */
export async function mineStreetNames(opts: MineOptions): Promise<MinedTerm[]> {
	return run(`
    WITH rests AS (
      SELECT property_id,
             substr(property_address || ' ', instr(property_address || ' ', ' ') + 1) AS rest
      ${gapFrom(opts)}
      AND property_address IS NOT NULL
    ),
    words AS (
      SELECT property_id, substr(rest, 1, instr(rest || ' ', ' ') - 1) AS term
      FROM rests
    )
    SELECT term, COUNT(DISTINCT property_id) AS cnt
    FROM words
    WHERE LENGTH(term) >= ${MIN_TERM_LENGTH}${opts.alphaOnly ? ` AND term ${ALPHA_GLOB}` : ""}
    GROUP BY term
    HAVING COUNT(DISTINCT property_id) >= ${opts.minCount}
    ORDER BY cnt DESC`);
}

/** First word of the description on gap properties. */
export async function mineDescriptionFirstWords(
	opts: MineOptions,
): Promise<MinedTerm[]> {
	return run(`
    WITH words AS (
      SELECT property_id,
             substr(description, 1, instr(description || ' ', ' ') - 1) AS term
      ${gapFrom(opts)}
      AND description IS NOT NULL
    )
    SELECT term, COUNT(DISTINCT property_id) AS cnt
    FROM words
    WHERE LENGTH(term) >= ${MIN_TERM_LENGTH}${opts.alphaOnly ? ` AND term ${ALPHA_GLOB}` : ""}
    GROUP BY term
    HAVING COUNT(DISTINCT property_id) >= ${opts.minCount}
    ORDER BY cnt DESC`);
}

/**
 * Two-word owner-name phrases on gap properties.
 * Requires w1 >= MIN_TERM_LENGTH and w2 >= 2 chars; `alphaOnly` applies to w1.
 */
export async function mineTwoWordOwnerNames(
	opts: MineOptions,
): Promise<MinedTerm[]> {
	return run(`
    WITH split1 AS (
      SELECT property_id,
             substr(name, 1, instr(name || ' ', ' ') - 1) AS w1,
             substr(name || ' ', instr(name || ' ', ' ') + 1) AS rest
      ${gapFrom(opts)}
    ),
    split2 AS (
      SELECT property_id, w1, substr(rest, 1, instr(rest || ' ', ' ') - 1) AS w2
      FROM split1
    )
    SELECT w1 || ' ' || w2 AS term, COUNT(DISTINCT property_id) AS cnt
    FROM split2
    WHERE LENGTH(w1) >= ${MIN_TERM_LENGTH} AND LENGTH(w2) >= 2${opts.alphaOnly ? ` AND w1 ${ALPHA_GLOB}` : ""}
    GROUP BY term
    HAVING COUNT(DISTINCT property_id) >= ${opts.minCount}
    ORDER BY cnt DESC`);
}

/**
 * Two-word phrases from entity owner names (LLC/INC/LP/LTD/TRUST) on gap
 * properties. Unlike mineTwoWordOwnerNames, applies no per-word length
 * filter — entity names keep short leading words (e.g. "ABC LLC").
 */
export async function mineEntityPhrases(
	opts: Omit<MineOptions, "alphaOnly">,
): Promise<MinedTerm[]> {
	return run(`
    WITH split1 AS (
      SELECT property_id,
             substr(name, 1, instr(name || ' ', ' ') - 1) AS w1,
             substr(name || ' ', instr(name || ' ', ' ') + 1) AS rest
      ${gapFrom(opts)}
      AND ${ENTITY_NAME_FILTER}
    )
    SELECT w1 || ' ' || substr(rest, 1, instr(rest || ' ', ' ') - 1) AS term,
           COUNT(DISTINCT property_id) AS cnt
    FROM split1
    GROUP BY term
    HAVING COUNT(DISTINCT property_id) >= ${opts.minCount}
    ORDER BY cnt DESC`);
}
