/**
 * Recent search terms summary — most recent scrape job per term with stored
 * property counts, straight from production D1.
 *
 * Usage: doppler run -- npx tsx scripts/search-terms-summary.ts
 *        (or: bash scripts/search-terms-summary.sh)
 */

import { prisma } from "./lib/d1-prisma";

const RECENT_TERM_LIMIT = 50;
const TERM_WIDTH = 41;
const COUNT_WIDTH = 12;
const STATUS_WIDTH = 13;
const DATE_WIDTH = 17;

interface TermRow {
	searchTerm: string;
	status: string;
	startedAt: string;
	completedAt: string | null;
	propertyCount: number;
}

function formatEpoch(epochMs: string): string {
	return new Date(Number(epochMs)).toLocaleString("en-US", {
		month: "short",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
}

async function getSearchTermStats() {
	// One round trip: latest job per term (SQLite bare columns resolve to the
	// MAX(started_at) row) + property count via the searchTerm-leading index.
	const rows = await prisma.$queryRaw<TermRow[]>`
    SELECT j.search_term AS searchTerm,
           j.status,
           MAX(j.started_at) AS startedAt,
           j.completed_at AS completedAt,
           (SELECT COUNT(*) FROM properties p WHERE p.search_term = j.search_term) AS propertyCount
    FROM scrape_jobs j
    GROUP BY j.search_term
    ORDER BY startedAt DESC
    LIMIT ${RECENT_TERM_LIMIT}
  `;

	console.log(
		`\n╔${"═".repeat(TERM_WIDTH + 2)}╦${"═".repeat(COUNT_WIDTH + 2)}╦${"═".repeat(STATUS_WIDTH + 2)}╦${"═".repeat(DATE_WIDTH + 2)}╗`,
	);
	console.log(
		`║ ${"Search Term".padEnd(TERM_WIDTH)} ║ ${"Properties".padEnd(COUNT_WIDTH)} ║ ${"Status".padEnd(STATUS_WIDTH)} ║ ${"Last Updated".padEnd(DATE_WIDTH)} ║`,
	);
	console.log(
		`╠${"═".repeat(TERM_WIDTH + 2)}╬${"═".repeat(COUNT_WIDTH + 2)}╬${"═".repeat(STATUS_WIDTH + 2)}╬${"═".repeat(DATE_WIDTH + 2)}╣`,
	);

	for (const row of rows) {
		const term = row.searchTerm.padEnd(TERM_WIDTH).substring(0, TERM_WIDTH);
		const count = String(Number(row.propertyCount)).padStart(COUNT_WIDTH);
		const status = row.status.padEnd(STATUS_WIDTH).substring(0, STATUS_WIDTH);
		const updated = formatEpoch(row.completedAt ?? row.startedAt).padEnd(
			DATE_WIDTH,
		);
		console.log(`║ ${term} ║ ${count} ║ ${status} ║ ${updated} ║`);
	}

	console.log(
		`╚${"═".repeat(TERM_WIDTH + 2)}╩${"═".repeat(COUNT_WIDTH + 2)}╩${"═".repeat(STATUS_WIDTH + 2)}╩${"═".repeat(DATE_WIDTH + 2)}╝`,
	);

	const totalProperties = rows.reduce(
		(sum, r) => sum + Number(r.propertyCount),
		0,
	);
	const avgProperties =
		rows.length > 0 ? (totalProperties / rows.length).toFixed(1) : "0";

	console.log(`\nTotal properties from these search terms: ${totalProperties}`);
	console.log(`Average properties per search term: ${avgProperties}`);
}

getSearchTermStats()
	.catch((err) => {
		console.error(err);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
