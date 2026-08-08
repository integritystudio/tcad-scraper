/**
 * Term-mining queries over "2026-only" properties — property_ids present in
 * year 2026 but absent from 2025. Shared by the backfill-2025* scripts and
 * enqueue-tail-terms.ts, which previously each carried their own copies of
 * these CTEs.
 *
 * Uses $queryRawUnsafe because the filters (HAVING threshold, GLOB fragment)
 * vary per caller; every interpolated value is an internal number or fixed
 * SQL fragment — no user input reaches these strings.
 */

import { MIN_TERM_LENGTH } from "../../utils/constants";
import { prisma } from "./d1-prisma";

export interface MinedTerm {
	term: string;
	/** Distinct 2026-only properties matching this term. */
	count: number;
}

export interface MineOptions {
	/** Minimum distinct 2026-only properties per term (HAVING threshold). */
	minCount: number;
	/** Keep only terms starting with a letter (GLOB '[A-Za-z]*'). */
	alphaOnly?: boolean;
}

const FROM_2026_ONLY = `FROM properties
      WHERE year = 2026
      AND property_id NOT IN (SELECT property_id FROM properties WHERE year = 2025)`;

const ALPHA_GLOB = `GLOB '[A-Za-z]*'`;

const ENTITY_NAME_FILTER = `(name LIKE '%LLC%' OR name LIKE '%INC%' OR name LIKE '%LP%'
           OR name LIKE '%LTD%' OR name LIKE '%TRUST%')`;

async function run(sql: string): Promise<MinedTerm[]> {
	const rows =
		await prisma.$queryRawUnsafe<Array<{ term: string; cnt: number | bigint }>>(
			sql,
		);
	return rows.map((r) => ({ term: r.term, count: Number(r.cnt) }));
}

/** First word of the owner name on 2026-only properties. */
export function mineOwnerFirstWords(opts: MineOptions): Promise<MinedTerm[]> {
	return run(`
    WITH words AS (
      SELECT property_id, substr(name, 1, instr(name || ' ', ' ') - 1) AS term
      ${FROM_2026_ONLY}
    )
    SELECT term, COUNT(DISTINCT property_id) AS cnt
    FROM words
    WHERE LENGTH(term) >= ${MIN_TERM_LENGTH}${opts.alphaOnly ? ` AND term ${ALPHA_GLOB}` : ""}
    GROUP BY term
    HAVING COUNT(DISTINCT property_id) >= ${opts.minCount}
    ORDER BY cnt DESC`);
}

/** Street name (second word of property_address) on 2026-only properties. */
export function mineStreetNames(opts: MineOptions): Promise<MinedTerm[]> {
	return run(`
    WITH rests AS (
      SELECT property_id,
             substr(property_address || ' ', instr(property_address || ' ', ' ') + 1) AS rest
      ${FROM_2026_ONLY}
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

/** First word of the description on 2026-only properties. */
export function mineDescriptionFirstWords(
	opts: MineOptions,
): Promise<MinedTerm[]> {
	return run(`
    WITH words AS (
      SELECT property_id,
             substr(description, 1, instr(description || ' ', ' ') - 1) AS term
      ${FROM_2026_ONLY}
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
 * Two-word owner-name phrases on 2026-only properties.
 * Requires w1 >= MIN_TERM_LENGTH and w2 >= 2 chars; `alphaOnly` applies to w1.
 */
export function mineTwoWordOwnerNames(opts: MineOptions): Promise<MinedTerm[]> {
	return run(`
    WITH split1 AS (
      SELECT property_id,
             substr(name, 1, instr(name || ' ', ' ') - 1) AS w1,
             substr(name || ' ', instr(name || ' ', ' ') + 1) AS rest
      ${FROM_2026_ONLY}
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
 * Two-word phrases from entity owner names (LLC/INC/LP/LTD/TRUST) on
 * 2026-only properties. Unlike mineTwoWordOwnerNames, applies no per-word
 * length filter — entity names keep short leading words (e.g. "ABC LLC").
 */
export function mineEntityPhrases(
	opts: Pick<MineOptions, "minCount">,
): Promise<MinedTerm[]> {
	return run(`
    WITH split1 AS (
      SELECT property_id,
             substr(name, 1, instr(name || ' ', ' ') - 1) AS w1,
             substr(name || ' ', instr(name || ' ', ' ') + 1) AS rest
      ${FROM_2026_ONLY}
      AND ${ENTITY_NAME_FILTER}
    )
    SELECT w1 || ' ' || substr(rest, 1, instr(rest || ' ', ' ') - 1) AS term,
           COUNT(DISTINCT property_id) AS cnt
    FROM split1
    GROUP BY term
    HAVING COUNT(DISTINCT property_id) >= ${opts.minCount}
    ORDER BY cnt DESC`);
}
