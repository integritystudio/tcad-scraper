#!/usr/bin/env tsx
/**
 * Search Term Analysis Script
 *
 * Analyzes search term usage and effectiveness to identify:
 * 1. Which search terms have been exhausted
 * 2. Which search terms still have potential
 * 3. Patterns in failed vs successful jobs
 *
 * Run: doppler run -- npx tsx scripts/analyze-search-terms.ts
 */

import { epochAgo, prisma } from "./lib/d1-prisma";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Approximate total TCAD property count — update periodically from https://tcad.org/
// Used for coverage percentage and threshold checks only; staleness won't affect scraping.
const TCAD_TOTAL_PROPERTIES = 451_339;

export async function analyzeSearchTerms(): Promise<void> {
	console.log("\n=== Search Term Analysis ===\n");

	// 1. Overall stats
	const totalJobs = await prisma.scrapeJob.count();
	const completedJobs = await prisma.scrapeJob.count({
		where: { status: "completed" },
	});
	const failedJobs = await prisma.scrapeJob.count({
		where: { status: "failed" },
	});
	const pendingJobs = await prisma.scrapeJob.count({
		where: { status: "pending" },
	});

	console.log("📊 Overall Job Stats:");
	console.log(`   Total jobs: ${totalJobs}`);
	console.log(
		`   Completed: ${completedJobs} (${((completedJobs / totalJobs) * 100).toFixed(1)}%)`,
	);
	console.log(
		`   Failed: ${failedJobs} (${((failedJobs / totalJobs) * 100).toFixed(1)}%)`,
	);
	console.log(`   Pending: ${pendingJobs}`);

	// 2. Unique search terms used
	const uniqueTermsResult = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(DISTINCT search_term) as count FROM scrape_jobs
  `;
	const uniqueTerms = Number(uniqueTermsResult[0].count);
	console.log(`\n📝 Unique search terms used: ${uniqueTerms}`);

	// 3. Top 20 most successful search terms
	console.log("\n✅ Top 20 Most Successful Search Terms:");
	const topTerms = await prisma.$queryRaw<
		{
			search_term: string;
			job_count: bigint;
			success_count: bigint;
			total_results: bigint;
			avg_results: number;
		}[]
	>`
    SELECT
      search_term,
      COUNT(*) as job_count,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success_count,
      SUM(COALESCE(result_count, 0)) as total_results,
      AVG(CASE WHEN status = 'completed' THEN result_count ELSE NULL END) as avg_results
    FROM scrape_jobs
    WHERE search_term IS NOT NULL
    GROUP BY search_term
    HAVING SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) > 0
    ORDER BY total_results DESC
    LIMIT 20
  `;

	topTerms.forEach((term, i) => {
		const successRate =
			(Number(term.success_count) / Number(term.job_count)) * 100;
		console.log(
			`   ${i + 1}. "${term.search_term}": ${Number(term.total_results).toLocaleString()} props ` +
				`(${Number(term.job_count)} jobs, ${successRate.toFixed(0)}% success, avg ${Math.round(term.avg_results || 0)}/job)`,
		);
	});

	// 4. Search terms that always fail (for blacklist)
	console.log("\n❌ Search Terms That Always Fail (top 20):");
	const failingTerms = await prisma.$queryRaw<
		{
			search_term: string;
			fail_count: bigint;
			last_error: string | null;
		}[]
	>`
    SELECT
      search_term,
      COUNT(*) as fail_count,
      MAX(error) as last_error
    FROM scrape_jobs
    WHERE status = 'failed' AND search_term IS NOT NULL
    GROUP BY search_term
    HAVING SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) = 0
    ORDER BY fail_count DESC
    LIMIT 20
  `;

	failingTerms.forEach((term, i) => {
		const errorPreview = term.last_error
			? term.last_error.substring(0, 50)
			: "Unknown";
		console.log(
			`   ${i + 1}. "${term.search_term}": ${Number(term.fail_count)} failures - ${errorPreview}...`,
		);
	});

	// 5. Recently successful terms (candidates for re-running)
	console.log("\n🔄 Recently Successful Terms (last 30 days):");
	const recentTerms = await prisma.$queryRaw<
		{
			search_term: string;
			result_count: number;
			completed_at: string; // epoch-ms string (D1 date encoding)
		}[]
	>`
    SELECT search_term, result_count, completed_at
    FROM scrape_jobs
    WHERE status = 'completed'
      AND completed_at > ${epochAgo(THIRTY_DAYS_MS)}
      AND result_count > 0
    ORDER BY completed_at DESC
    LIMIT 10
  `;

	if (recentTerms.length === 0) {
		console.log("   ⚠️ No successful jobs in last 30 days!");
	} else {
		recentTerms.forEach((term, i) => {
			console.log(
				`   ${i + 1}. "${term.search_term}": ${term.result_count} props (${new Date(Number(term.completed_at)).toLocaleDateString()})`,
			);
		});
	}

	// 6. Search term categories breakdown
	console.log("\n📂 Search Term Categories:");

	const categories = {
		"Entity (LLC, Inc, Corp, Trust)": await countTermsMatching([
			"LLC",
			"Inc",
			"Corp",
			"Trust",
			"LTD",
		]),
		"First Names (common)": await countTermsMatching([
			"James",
			"John",
			"Mary",
			"Robert",
			"Michael",
		]),
		"Last Names (common)": await countTermsMatching([
			"Smith",
			"Johnson",
			"Williams",
			"Brown",
			"Jones",
		]),
		Streets: await countTermsMatching([
			"Lamar",
			"Congress",
			"Guadalupe",
			"Burnet",
			"Airport",
		]),
		Neighborhoods: await countTermsMatching([
			"Hyde",
			"Park",
			"Zilker",
			"Mueller",
			"Barton",
		]),
	};

	for (const [category, count] of Object.entries(categories)) {
		console.log(`   ${category}: ${count} unique terms used`);
	}

	// 7. Property coverage analysis
	console.log("\n📊 Property Coverage:");
	const propertyCount = await prisma.property.count();
	console.log(`   Total properties in DB: ${propertyCount.toLocaleString()}`);
	console.log(
		`   Target (TCAD total): ${TCAD_TOTAL_PROPERTIES.toLocaleString()}`,
	);
	if (propertyCount > TCAD_TOTAL_PROPERTIES) {
		console.warn(
			`   ⚠️  DB count (${propertyCount.toLocaleString()}) exceeds TCAD_TOTAL_PROPERTIES (${TCAD_TOTAL_PROPERTIES.toLocaleString()}) — constant may be stale; update line 17`,
		);
	}
	console.log(
		`   Coverage: ${((propertyCount / TCAD_TOTAL_PROPERTIES) * 100).toFixed(1)}%`,
	);
	console.log(
		`   Remaining: ${Math.max(0, TCAD_TOTAL_PROPERTIES - propertyCount).toLocaleString()}`,
	);

	// 8. Recommendations
	console.log("\n💡 Recommendations:");
	if (failedJobs / totalJobs > 0.3) {
		console.log("   ⚠️ High failure rate (>30%) - check TCAD API/token issues");
	}
	if (recentTerms.length === 0) {
		console.log(
			"   ⚠️ No recent successful scrapes - check wrangler tail, then re-enqueue via generate-next-200-terms.ts --enqueue",
		);
	}
	if (uniqueTerms < 1000) {
		console.log("   📝 Consider adding more search terms to pattern generator");
	}
	if (propertyCount / TCAD_TOTAL_PROPERTIES > 0.9) {
		console.log(
			"   ✅ High coverage achieved - focus on entity/trust searches for remaining properties",
		);
	}
}

async function countTermsMatching(patterns: string[]): Promise<number> {
	// SQLite LIKE is ASCII case-insensitive by default (no ILIKE / ANY)
	const rows = await prisma.scrapeJob.findMany({
		where: { OR: patterns.map((p) => ({ searchTerm: { contains: p } })) },
		distinct: ["searchTerm"],
		select: { searchTerm: true },
	});
	return rows.length;
}

if (require.main === module) {
	analyzeSearchTerms()
		.catch(console.error)
		.finally(() => process.exit(0));
}
