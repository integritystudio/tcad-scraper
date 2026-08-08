/**
 * Backfill a tax year using PROVEN high-yield terms — terms that already
 * returned MIN_SOURCE_YIELD+ properties for the source year but have none
 * for the year being filled.
 *
 * These are the cheapest wins in a fresh roll year: the source year has
 * already demonstrated that each term reaches a large block of Travis County
 * properties, and the roll changes by only a few percent year over year.
 *
 * The source year is resolved from D1 (most-populated other year), so the
 * direction flips on its own each roll season.
 *
 * Usage: TCAD_YEAR=2026 doppler run -- npx tsx scripts/backfill-proven.ts
 */

import { runBackfillMain } from "./lib/backfill-runner";
import { resolveSourceYear } from "./lib/backfill-utils";
import { prisma } from "./lib/d1-prisma";
import { getSearchedTermSets } from "./lib/searched-terms";

const MIN_SOURCE_YIELD = 100;

async function getProvenTerms(targetYear: number): Promise<string[]> {
	const sourceYear = await resolveSourceYear(targetYear);
	if (sourceYear === null) {
		console.log(
			`  No other tax year in D1 to mine proven terms from — nothing to do.`,
		);
		return [];
	}
	console.log(`  Source year: ${sourceYear} → target: ${targetYear}`);

	// Terms that yielded MIN_SOURCE_YIELD+ properties for the source year but
	// have none attributed for the target year.
	const terms = await prisma.$queryRaw<Array<{ term: string; src: number }>>`
    SELECT src.search_term as term, src.cnt as src
    FROM (
      SELECT search_term, COUNT(DISTINCT property_id) as cnt
      FROM properties WHERE year = ${sourceYear}
      GROUP BY search_term
      HAVING COUNT(DISTINCT property_id) >= ${MIN_SOURCE_YIELD}
    ) src
    LEFT JOIN (
      SELECT search_term, COUNT(DISTINCT property_id) as cnt
      FROM properties WHERE year = ${targetYear}
      GROUP BY search_term
    ) tgt ON src.search_term = tgt.search_term
    WHERE COALESCE(tgt.cnt, 0) = 0
    ORDER BY src.cnt DESC`;

	// Also exclude terms already attempted for the target year (property match
	// or in-flight job).
	const { searchedForYear } = await getSearchedTermSets(targetYear);

	const result: string[] = [];
	let skipped = 0;
	for (const t of terms) {
		if (searchedForYear.has(t.term.toLowerCase())) {
			skipped++;
			continue;
		}
		result.push(t.term);
	}

	console.log(
		`  Proven terms (${MIN_SOURCE_YIELD}+ yield in ${sourceYear}, 0 in ${targetYear}): ${terms.length}`,
	);
	console.log(`  Skipped (already searched for ${targetYear}): ${skipped}`);
	console.log(`  Queued: ${result.length}`);
	return result;
}

runBackfillMain({
	getTerms: getProvenTerms,
	label: "Proven Source-Year Terms",
});
