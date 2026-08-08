/**
 * Compute the most efficient set of TCAD search terms to cover a tax year.
 *
 * Solves maximum coverage greedily over a model of the roll built from the
 * most complete year already in D1 (see lib/coverage-optimizer.ts for the
 * model and its limits), then reports the marginal-coverage curve: how many
 * terms buy 50%, 90%, 99% of the roll, and where the tail stops paying.
 *
 * The point is to spend scrapes where they add properties. Covering 2026 by
 * replaying every term that ever yielded for 2025 means ~3,300 scrapes, most
 * of them returning properties three earlier terms already saved. Greedy
 * selection reaches the same coverage in a fraction of the runs.
 *
 * Usage:
 *   TCAD_YEAR=2026 doppler run -- npx tsx scripts/optimize-coverage.ts
 *   TCAD_YEAR=2026 doppler run -- npx tsx scripts/optimize-coverage.ts --enqueue
 *
 * Flags:
 *   --enqueue           send the selected terms to the Workers API (default: dry run)
 *   --model-year N      corpus to plan against (default: most-populated year in D1)
 *   --target N          coverage fraction to stop at, 0-1 (default 0.995)
 *   --max-terms N       hard cap on selected terms
 *   --min-gain N        stop when the next term adds fewer than N properties
 *   --limit N           only enqueue the first N selected terms
 */

import { pathToFileURL } from "node:url";
import { DEFAULT_TCAD_YEAR, MIN_TERM_LENGTH } from "../utils/constants";
import { runBackfill } from "./lib/backfill-runner";
import {
	buildCoverageIndex,
	buildCoveredMask,
	type CorpusRow,
	DEFAULT_MIN_MARGINAL_GAIN,
	DEFAULT_TARGET_FRACTION,
	greedyCover,
} from "./lib/coverage-optimizer";
import { prisma } from "./lib/d1-prisma";
import { runMain } from "./lib/run-main";
import {
	getBlacklistedTermSet,
	getSearchedTermSets,
} from "./lib/searched-terms";
import { BLOCKED_TERMS } from "./lib/terms/BLOCKED_TERMS";
import { TRUNCATION_BUG_ROOTS } from "./lib/terms/TRUNCATION_BUG_ROOTS";

/** Rows per keyset page. 20k returns in <1s over the D1 HTTP query API. */
const CORPUS_PAGE_SIZE = 20_000;
/** Coverage checkpoints reported in the marginal-coverage curve. */
const CURVE_CHECKPOINTS = [0.5, 0.75, 0.9, 0.95, 0.99] as const;
const PREVIEW_TERMS = 40;
const PERCENT = 100;

function numericFlag(name: string): number | undefined {
	const idx = process.argv.indexOf(name);
	if (idx === -1 || idx + 1 >= process.argv.length) return undefined;
	const value = Number(process.argv[idx + 1]);
	return Number.isFinite(value) ? value : undefined;
}

/** The year with the most scraped properties — the best available model of the roll. */
async function resolveModelYear(): Promise<{ year: number; count: number }> {
	const rows = await prisma.$queryRaw<Array<{ year: number; cnt: number }>>`
    SELECT year, COUNT(*) AS cnt
    FROM properties
    GROUP BY year
    ORDER BY cnt DESC
    LIMIT 1`;
	if (rows.length === 0) {
		throw new Error(
			"No properties in D1 — nothing to model coverage against. Scrape a year first.",
		);
	}
	return { year: Number(rows[0].year), count: Number(rows[0].cnt) };
}

/**
 * Stream a year's searchable columns out of D1.
 *
 * Keyset pagination on the `id` primary key, not LIMIT/OFFSET — at ~500k rows
 * an OFFSET scan re-walks every skipped row on each page and turns a 25-page
 * export into a quadratic one.
 */
async function fetchCorpus(year: number): Promise<CorpusRow[]> {
	const rows: CorpusRow[] = [];
	let cursor = "";
	for (;;) {
		const page = await prisma.$queryRaw<
			Array<{
				id: string;
				name: string | null;
				property_address: string | null;
			}>
		>`
      SELECT id, name, property_address
      FROM properties
      WHERE year = ${year} AND id > ${cursor}
      ORDER BY id
      LIMIT ${CORPUS_PAGE_SIZE}`;
		if (page.length === 0) break;
		for (const r of page) {
			rows.push({ name: r.name, property_address: r.property_address });
		}
		cursor = page[page.length - 1].id;
		process.stderr.write(`\r  Fetched ${rows.length.toLocaleString()} rows...`);
		if (page.length < CORPUS_PAGE_SIZE) break;
	}
	process.stderr.write("\n");
	return rows;
}

/**
 * Prefixes that must never be selected: TCAD returns malformed JSON for
 * certain 4-char roots (docs/truncated-response-terms.md), some terms are
 * blocked outright, and blacklisted terms have failed repeatedly.
 */
async function buildExclusions(): Promise<Set<string>> {
	const blacklist = await getBlacklistedTermSet();
	const excluded = new Set<string>();
	for (const source of [TRUNCATION_BUG_ROOTS, BLOCKED_TERMS, blacklist]) {
		for (const term of source) {
			const lower = term.toLowerCase();
			if (lower.length >= MIN_TERM_LENGTH) {
				excluded.add(lower.slice(0, MIN_TERM_LENGTH));
			}
		}
	}
	return excluded;
}

export async function main(): Promise<void> {
	const targetYear = process.env.TCAD_YEAR
		? parseInt(process.env.TCAD_YEAR, 10)
		: DEFAULT_TCAD_YEAR;
	const enqueueMode = process.argv.includes("--enqueue");
	const targetFraction = numericFlag("--target") ?? DEFAULT_TARGET_FRACTION;
	const minMarginalGain =
		numericFlag("--min-gain") ?? DEFAULT_MIN_MARGINAL_GAIN;
	const maxTerms = numericFlag("--max-terms");
	const enqueueLimit = numericFlag("--limit");

	const modelYearFlag = numericFlag("--model-year");
	const model = modelYearFlag
		? { year: modelYearFlag, count: 0 }
		: await resolveModelYear();

	console.error(`Target year:  ${targetYear}`);
	console.error(`Model corpus: ${model.year}`);

	console.error("\nFetching model corpus from D1...");
	const rows = await fetchCorpus(model.year);
	if (rows.length === 0) {
		throw new Error(`No properties for year ${model.year} — nothing to model.`);
	}

	console.error("Building prefix index...");
	const excluded = await buildExclusions();
	const index = buildCoverageIndex(rows, { excluded });
	console.error(
		`  ${index.postings.size.toLocaleString()} candidate terms over ` +
			`${index.propertyCount.toLocaleString()} properties ` +
			`(${index.unreachableCount.toLocaleString()} unreachable by any 4-char term)`,
	);

	// Terms already run for the target year are credited before selection, so
	// a mid-backfill run plans only the remainder.
	const { searchedForYear } = await getSearchedTermSets(targetYear);
	console.error(
		`\nAlready searched for ${targetYear}: ${searchedForYear.size.toLocaleString()} terms`,
	);
	const preCoveredMask = buildCoveredMask(rows, searchedForYear);

	console.error("Running greedy maximum-coverage selection...");
	const result = greedyCover(index, {
		preCoveredMask,
		excludeTerms: excluded,
		targetFraction,
		minMarginalGain,
		maxTerms,
	});

	// ── Report ────────────────────────────────────────────────────────
	const pct = (n: number): string =>
		`${((n / result.propertyCount) * PERCENT).toFixed(2)}%`;

	console.error(`\n${"═".repeat(64)}`);
	console.error(`Coverage plan for ${targetYear} (modeled on ${model.year})`);
	console.error("═".repeat(64));
	console.error(
		`  Model corpus:       ${result.propertyCount.toLocaleString()} properties`,
	);
	console.error(
		`  Already covered:    ${result.preCovered.toLocaleString()} (${pct(result.preCovered)})`,
	);
	console.error(
		`  Terms selected:     ${result.selected.length.toLocaleString()}`,
	);
	console.error(
		`  Projected coverage: ${result.totalCovered.toLocaleString()} (${pct(result.totalCovered)})`,
	);
	console.error(`  Stopped because:    ${result.stoppedBecause}`);

	console.error("\n  Marginal-coverage curve (terms needed to reach):");
	for (const checkpoint of CURVE_CHECKPOINTS) {
		const need = result.selected.findIndex(
			(s) => s.cumulativeFraction >= checkpoint,
		);
		console.error(
			need === -1
				? `    ${(checkpoint * PERCENT).toFixed(0)}%: not reached`
				: `    ${(checkpoint * PERCENT).toFixed(0)}%: ${need + 1} terms`,
		);
	}

	console.error(`\n  Top ${PREVIEW_TERMS} terms by marginal coverage:`);
	for (const s of result.selected.slice(0, PREVIEW_TERMS)) {
		console.error(
			`    ${s.term.padEnd(10)} +${s.newlyCovered.toLocaleString().padStart(7)}  →  ${(s.cumulativeFraction * PERCENT).toFixed(2)}%`,
		);
	}

	// stdout carries only the term list, so the script pipes cleanly.
	const terms = result.selected.map((s) => s.term);
	for (const term of terms) console.log(term);

	if (!enqueueMode) {
		if (terms.length > 0) {
			console.error(
				`\nDry run — pass --enqueue to queue these ${terms.length} terms.`,
			);
		}
		return;
	}
	if (terms.length === 0) return;

	// Hand the plan to the shared backfill loop rather than firing every term
	// at the API at once: it batches, waits for each batch to drain, and
	// reports the properties actually gained, so a plan that stops paying off
	// is visible while it runs instead of after 1,000 queued jobs.
	const toEnqueue = enqueueLimit ? terms.slice(0, enqueueLimit) : terms;
	await runBackfill({
		getTerms: async () => toEnqueue,
		label: `Coverage Plan (${toEnqueue.length} terms)`,
	});
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	runMain(main);
}
