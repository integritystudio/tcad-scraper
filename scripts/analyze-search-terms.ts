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

import { pathToFileURL } from "node:url";
import {
	TARGET_2025_PROPERTY_COUNT,
	THIRTY_DAY_LOOKBACK_MS,
} from "../utils/constants";
import { get2025Count } from "./lib/backfill-utils";
import { epochAgo, prisma } from "./lib/d1-prisma";
import { getJobStats } from "./lib/job-stats";
import logger from "./lib/logger";
import { runMain } from "./lib/run-main";

export async function analyzeSearchTerms(): Promise<void> {
	logger.info("\n=== Search Term Analysis ===\n");

	// 1. Overall stats
	const {
		totalJobs,
		completedJobs,
		failedJobs,
		pendingJobs,
		completedRate,
		failedRate,
	} = await getJobStats();

	logger.info("📊 Overall Job Stats:");
	logger.info(`   Total jobs: ${totalJobs}`);
	logger.info(`   Completed: ${completedJobs} (${completedRate.toFixed(1)}%)`);
	logger.info(`   Failed: ${failedJobs} (${failedRate.toFixed(1)}%)`);
	logger.info(`   Pending: ${pendingJobs}`);

	// 2. Unique search terms used
	const uniqueTermsResult = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(DISTINCT search_term) as count FROM scrape_jobs
  `;
	const uniqueTerms = Number(uniqueTermsResult[0].count);
	logger.info(`\n📝 Unique search terms used: ${uniqueTerms}`);

	// 3. Top 20 most successful search terms
	logger.info("\n✅ Top 20 Most Successful Search Terms:");
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
		logger.info(
			`   ${i + 1}. "${term.search_term}": ${Number(term.total_results).toLocaleString()} props ` +
				`(${Number(term.job_count)} jobs, ${successRate.toFixed(0)}% success, avg ${Math.round(term.avg_results || 0)}/job)`,
		);
	});

	// 4. Search terms that always fail (for blacklist)
	logger.info("\n❌ Search Terms That Always Fail (top 20):");
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
		logger.info(
			`   ${i + 1}. "${term.search_term}": ${Number(term.fail_count)} failures - ${errorPreview}...`,
		);
	});

	// 5. Recently successful terms (candidates for re-running)
	logger.info("\n🔄 Recently Successful Terms (last 30 days):");
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
      AND completed_at > ${epochAgo(THIRTY_DAY_LOOKBACK_MS)}
      AND result_count > 0
    ORDER BY completed_at DESC
    LIMIT 10
  `;

	if (recentTerms.length === 0) {
		logger.info("   ⚠️ No successful jobs in last 30 days!");
	} else {
		recentTerms.forEach((term, i) => {
			logger.info(
				`   ${i + 1}. "${term.search_term}": ${term.result_count} props (${new Date(Number(term.completed_at)).toLocaleDateString()})`,
			);
		});
	}

	// 6. Search term categories breakdown
	logger.info("\n📂 Search Term Categories:");

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
		logger.info(`   ${category}: ${count} unique terms used`);
	}

	// 7. Property coverage analysis (2025 tax year, matching TARGET_2025_PROPERTY_COUNT)
	logger.info("\n📊 Property Coverage:");
	const propertyCount = await get2025Count();
	logger.info(`   2025 properties in DB: ${propertyCount.toLocaleString()}`);
	logger.info(`   Target: ${TARGET_2025_PROPERTY_COUNT.toLocaleString()}`);
	if (propertyCount > TARGET_2025_PROPERTY_COUNT) {
		logger.warn(
			`   ⚠️  DB count (${propertyCount.toLocaleString()}) exceeds TARGET_2025_PROPERTY_COUNT (${TARGET_2025_PROPERTY_COUNT.toLocaleString()}) — constant may be stale; update utils/constants.ts`,
		);
	}
	logger.info(
		`   Coverage: ${((propertyCount / TARGET_2025_PROPERTY_COUNT) * 100).toFixed(1)}%`,
	);
	logger.info(
		`   Remaining: ${Math.max(0, TARGET_2025_PROPERTY_COUNT - propertyCount).toLocaleString()}`,
	);

	// 8. Recommendations
	logger.info("\n💡 Recommendations:");
	if (failedRate > 30) {
		logger.info("   ⚠️ High failure rate (>30%) - check TCAD API/token issues");
	}
	if (recentTerms.length === 0) {
		logger.info(
			"   ⚠️ No recent successful scrapes - check wrangler tail, then re-enqueue via generate-next-200-terms.ts --enqueue",
		);
	}
	if (uniqueTerms < 1000) {
		logger.info("   📝 Consider adding more search terms to pattern generator");
	}
	if (propertyCount / TARGET_2025_PROPERTY_COUNT > 0.9) {
		logger.info(
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

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	runMain(analyzeSearchTerms);
}
