#!/usr/bin/env npx tsx

import { Command } from "commander";
import logger from "../lib/logger";
import { prisma } from "../lib/prisma";
import { scraperQueue } from "../queues/scraper.queue";

interface AnalyzerOptions {
	top?: string;
	minResults?: string;
	limit?: string;
	days?: string;
}

const program = new Command();

program
	.name("queue-analyzer")
	.description("Analyze queue performance and search term effectiveness")
	.version("1.0.0");

/**
 * Analyze successful search terms by category
 */
program
	.command("success")
	.description("Analyze most successful search term patterns")
	.option("--top <n>", "Show top N examples per category", "5")
	.action(async (options: AnalyzerOptions) => {
		logger.info("🔍 Analyzing Most Successful Search Term Types\n");
		logger.info("=".repeat(70));

		// Get all successful jobs (with results)
		const successfulJobs = await prisma.scrapeJob.findMany({
			where: {
				status: "completed",
				resultCount: { gt: 0 },
			},
			select: {
				searchTerm: true,
				resultCount: true,
			},
			orderBy: {
				resultCount: "desc",
			},
		});

		logger.info(
			`\n📊 Total successful scrapes: ${successfulJobs.length.toLocaleString()}`,
		);

		const totalProperties = successfulJobs.reduce(
			(sum, job) => sum + (job.resultCount || 0),
			0,
		);
		logger.info(
			`📊 Total properties found: ${totalProperties.toLocaleString()}`,
		);
		logger.info(
			`📊 Average per successful search: ${(totalProperties / successfulJobs.length).toFixed(1)}`,
		);

		// Categorize search terms
		const categories = {
			singleLastName: [] as typeof successfulJobs,
			fullName: [] as typeof successfulJobs,
			businessWithSuffix: [] as typeof successfulJobs,
			businessGeneric: [] as typeof successfulJobs,
			streetAddress: [] as typeof successfulJobs,
			streetName: [] as typeof successfulJobs,
			shortCode: [] as typeof successfulJobs,
			other: [] as typeof successfulJobs,
		};

		const businessSuffixes =
			/\b(LLC|Inc|Corp|Company|Trust|Foundation|Partners|Group|Properties|Ventures|Capital|Holdings|Development|Estate|Assets|Portfolio|LTD|Enterprises|Management|Realty|Investment)\b/i;
		const streetSuffixes =
			/\b(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Circle|Cir|Way|Place|Pl|Parkway|Loop|Trail|Path|Highway|Hwy)\b/i;
		const commonStreets =
			/\b(Lamar|Congress|Riverside|Guadalupe|Airport|Burnet|Mopac|Anderson|MLK|Oltorf|Barton|Springs|Research|Metric|Wells Branch|Far West|Dean Keeton|Speedway|Red River|Manchaca|William Cannon|Slaughter|Parmer|Braker|Rundberg|Koenig|North Loop|South Congress|East Riverside|West Anderson|Capital of Texas|Loop 360|IH 35|Enfield|Exposition|Westlake|Windsor|Oak|Rainey|Cameron|Duval|San Jacinto|Shoal Creek|Cesar Chavez|Main|Howard|McNeil|Dessau|Jollyville|Spicewood|Bee Cave|Balcones|Mueller|Cherrywood|Sabine|Nueces|Trinity|Rio Grande|Manor|Springdale)\b/i;

		successfulJobs.forEach((job) => {
			const term = job.searchTerm;
			const words = term.split(/\s+/);

			// Check for street address (starts with number + street name)
			if (
				/^\d+\s+/.test(term) &&
				(streetSuffixes.test(term) || commonStreets.test(term))
			) {
				categories.streetAddress.push(job);
			}
			// Check for street name only
			else if (streetSuffixes.test(term) || commonStreets.test(term)) {
				categories.streetName.push(job);
			}
			// Check for business with suffix
			else if (businessSuffixes.test(term)) {
				categories.businessWithSuffix.push(job);
			}
			// Check for full name (2-3 words, mostly letters, capitalized)
			else if (
				words.length >= 2 &&
				words.length <= 3 &&
				/^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(term)
			) {
				categories.fullName.push(job);
			}
			// Check for single last name (one word, mostly letters, capitalized)
			else if (
				words.length === 1 &&
				/^[A-Z][a-z]+$/.test(term) &&
				term.length > 3
			) {
				categories.singleLastName.push(job);
			}
			// Check for short codes (alphanumeric, short)
			else if (term.length <= 6 && /[A-Z0-9]/.test(term)) {
				categories.shortCode.push(job);
			}
			// Everything else
			else {
				categories.other.push(job);
			}
		});

		// Calculate statistics for each category
		const stats = Object.entries(categories)
			.map(([name, jobs]) => {
				const total = jobs.reduce(
					(sum, job) => sum + (job.resultCount || 0),
					0,
				);
				const avg = jobs.length > 0 ? total / jobs.length : 0;
				const max =
					jobs.length > 0
						? Math.max(...jobs.map((j) => j.resultCount || 0))
						: 0;
				return {
					name,
					count: jobs.length,
					totalProperties: total,
					avgProperties: avg,
					maxProperties: max,
					percentage: (jobs.length / successfulJobs.length) * 100,
				};
			})
			.sort((a, b) => b.totalProperties - a.totalProperties);

		logger.info("\n📋 Search Term Categories (by total properties found):\n");
		stats.forEach((stat, idx) => {
			const categoryName = stat.name
				.replace(/([A-Z])/g, " $1")
				.replace(/^./, (str) => str.toUpperCase())
				.trim();

			logger.info(`${idx + 1}. ${categoryName}`);
			logger.info(
				`   Searches: ${stat.count.toLocaleString()} (${stat.percentage.toFixed(1)}%)`,
			);
			logger.info(`   Properties: ${stat.totalProperties.toLocaleString()}`);
			logger.info(`   Avg per search: ${stat.avgProperties.toFixed(1)}`);
			logger.info(`   Max in single search: ${stat.maxProperties}`);
			logger.info("");
		});

		// Show top examples from each category
		logger.info("=".repeat(70));
		logger.info("\n🏆 TOP PERFORMERS BY CATEGORY:\n");

		const topN = parseInt(options.top || "0", 10);

		for (const [categoryName, jobs] of Object.entries(categories)) {
			if (jobs.length === 0) continue;

			const displayName = categoryName
				.replace(/([A-Z])/g, " $1")
				.replace(/^./, (str) => str.toUpperCase())
				.trim();

			logger.info(`\n${displayName} (${jobs.length} total):`);

			const topJobs = jobs
				.sort((a, b) => (b.resultCount || 0) - (a.resultCount || 0))
				.slice(0, topN);

			topJobs.forEach((job, idx) => {
				logger.info(
					`  ${idx + 1}. "${job.searchTerm}" - ${(job.resultCount || 0).toLocaleString()} properties`,
				);
			});
		}

		logger.info(`\n${"=".repeat(70)}`);
		logger.info("\n💡 Insights:");
		logger.info(
			"   - Focus on search term types with high avg properties per search",
		);
		logger.info(
			'   - Consider filtering out or deprioritizing "Short Code" and "Other" categories',
		);
		logger.info(
			"   - Business names with suffixes (LLC, Trust, etc.) are highly effective",
		);

		await cleanup();
	});

/**
 * Analyze failed searches
 */
program
	.command("failures")
	.description("Analyze failed search patterns and zero-result terms")
	.option("--limit <n>", "Limit results", "50")
	.action(async (options: AnalyzerOptions) => {
		logger.info("❌ Analyzing Failed and Zero-Result Searches\n");
		logger.info("=".repeat(70));

		// Get failed jobs
		const failedJobs = await prisma.scrapeJob.findMany({
			where: { status: "failed" },
			select: {
				searchTerm: true,
				error: true,
			},
			take: parseInt(options.limit || "0", 10),
		});

		logger.info(`\n📊 Failed Jobs: ${failedJobs.length}`);

		if (failedJobs.length > 0) {
			logger.info("\nCommon Failure Patterns:");
			const errorCounts: Record<string, number> = {};

			failedJobs.forEach((job) => {
				const errorType = job.error
					? job.error.split(":")[0].trim()
					: "Unknown";
				errorCounts[errorType] = (errorCounts[errorType] || 0) + 1;
			});

			Object.entries(errorCounts)
				.sort((a, b) => b[1] - a[1])
				.forEach(([error, count]) => {
					logger.info(`   - ${error}: ${count} occurrences`);
				});
		}

		// Get zero-result jobs
		const zeroResultJobs = await prisma.scrapeJob.findMany({
			where: {
				status: "completed",
				resultCount: 0,
			},
			select: {
				searchTerm: true,
			},
			take: parseInt(options.limit || "0", 10),
		});

		logger.info(`\n📊 Zero-Result Searches: ${zeroResultJobs.length}`);

		// Analyze zero-result patterns
		if (zeroResultJobs.length > 0) {
			const patterns = {
				tooShort: zeroResultJobs.filter((j) => j.searchTerm.length <= 2),
				numbers: zeroResultJobs.filter((j) => /^\d+$/.test(j.searchTerm)),
				specialChars: zeroResultJobs.filter((j) =>
					/[^a-zA-Z0-9\s]/.test(j.searchTerm),
				),
				singleLetter: zeroResultJobs.filter((j) =>
					/^[A-Z]$/.test(j.searchTerm),
				),
			};

			logger.info("\nZero-Result Patterns:");
			logger.info(`   - Too short (<= 2 chars): ${patterns.tooShort.length}`);
			logger.info(`   - Pure numbers: ${patterns.numbers.length}`);
			logger.info(
				`   - Contains special chars: ${patterns.specialChars.length}`,
			);
			logger.info(`   - Single letter: ${patterns.singleLetter.length}`);

			logger.info("\nSample Zero-Result Terms:");
			zeroResultJobs.slice(0, 10).forEach((job, idx) => {
				logger.info(`   ${idx + 1}. "${job.searchTerm}"`);
			});
		}

		logger.info(`\n${"=".repeat(70)}`);
		logger.info("\n💡 Recommendations:");
		logger.info("   - Filter out single letters and numbers before queuing");
		logger.info("   - Implement minimum length requirement (3+ characters)");
		logger.info("   - Consider removing terms with special characters");
		logger.info(
			'   - Use "queue-manager cleanup --zero-results" to clean queue',
		);

		await cleanup();
	});

/**
 * Analyze queue performance metrics
 */
program
	.command("performance")
	.description("Analyze queue performance metrics and throughput")
	.option("--days <n>", "Analyze last N days", "7")
	.action(async (options: AnalyzerOptions) => {
		logger.info("⚡ Queue Performance Analysis\n");
		logger.info("=".repeat(70));

		const days = parseInt(options.days || "0", 10);
		const since = new Date();
		since.setDate(since.getDate() - days);

		// Get completed jobs in timeframe
		const completed = await prisma.scrapeJob.findMany({
			where: {
				status: "completed",
				completedAt: { gte: since },
			},
			select: {
				searchTerm: true,
				resultCount: true,
				completedAt: true,
				startedAt: true,
			},
		});

		logger.info(
			`\n📊 Jobs completed in last ${days} days: ${completed.length}`,
		);

		if (completed.length === 0) {
			logger.info("\nNo completed jobs in this timeframe.");
			await cleanup();
			return;
		}

		// Calculate throughput
		const totalProperties = completed.reduce(
			(sum, j) => sum + (j.resultCount || 0),
			0,
		);
		const avgPropertiesPerJob = totalProperties / completed.length;
		const jobsPerDay = completed.length / days;
		const propertiesPerDay = totalProperties / days;

		logger.info(`\n📈 Throughput:`);
		logger.info(`   - Jobs per day: ${jobsPerDay.toFixed(1)}`);
		logger.info(`   - Properties per day: ${propertiesPerDay.toFixed(0)}`);
		logger.info(
			`   - Avg properties per job: ${avgPropertiesPerJob.toFixed(1)}`,
		);

		// Calculate processing time
		const processingTimes = completed
			.filter(
				(j): j is typeof j & { startedAt: number; completedAt: number } =>
					j.startedAt != null && j.completedAt != null,
			)
			.map((j) => {
				const created = new Date(j.startedAt).getTime();
				const completedTime = new Date(j.completedAt).getTime();
				return (completedTime - created) / 1000; // seconds
			});

		if (processingTimes.length > 0) {
			const avgTime =
				processingTimes.reduce((sum, t) => sum + t, 0) / processingTimes.length;
			const minTime = Math.min(...processingTimes);
			const maxTime = Math.max(...processingTimes);

			logger.info(`\n⏱️  Processing Time:`);
			logger.info(`   - Average: ${(avgTime / 60).toFixed(1)} minutes`);
			logger.info(`   - Minimum: ${(minTime / 60).toFixed(1)} minutes`);
			logger.info(`   - Maximum: ${(maxTime / 60).toFixed(1)} minutes`);
		}

		// Get current queue metrics
		const [waiting, active, failed] = await Promise.all([
			scraperQueue.getWaitingCount(),
			scraperQueue.getActiveCount(),
			scraperQueue.getFailedCount(),
		]);

		logger.info(`\n📊 Current Queue State:`);
		logger.info(`   - Waiting: ${waiting}`);
		logger.info(`   - Active: ${active}`);
		logger.info(`   - Failed: ${failed}`);

		// Estimate completion time
		if (waiting > 0 && jobsPerDay > 0) {
			const daysToComplete = waiting / jobsPerDay;
			logger.info(
				`\n⏳ Estimated time to clear queue: ${daysToComplete.toFixed(1)} days`,
			);
		}

		// Success rate
		const totalJobsAttempted = completed.length + failed;
		const successRate = (completed.length / totalJobsAttempted) * 100;

		logger.info(
			`\n✅ Success Rate: ${successRate.toFixed(1)}% (${completed.length}/${totalJobsAttempted})`,
		);

		logger.info(`\n${"=".repeat(70)}`);

		await cleanup();
	});

/**
 * Comprehensive queue overview
 */
program
	.command("overview")
	.description("Show comprehensive queue and performance overview")
	.action(async () => {
		logger.info("📊 Queue Overview\n");
		logger.info("=".repeat(70));

		// Get all counts
		const [waiting, active, delayed, completed, failed] = await Promise.all([
			scraperQueue.getWaitingCount(),
			scraperQueue.getActiveCount(),
			scraperQueue.getDelayedCount(),
			scraperQueue.getCompletedCount(),
			scraperQueue.getFailedCount(),
		]);

		logger.info(`\n🔢 Queue Counts:`);
		logger.info(`   - Waiting: ${waiting}`);
		logger.info(`   - Active: ${active}`);
		logger.info(`   - Delayed: ${delayed}`);
		logger.info(`   - Completed: ${completed}`);
		logger.info(`   - Failed: ${failed}`);

		// Get database stats
		const [totalProperties, totalJobs, distinctTerms] = await Promise.all([
			prisma.property.count(),
			prisma.scrapeJob.count(),
			prisma.scrapeJob
				.findMany({
					select: { searchTerm: true },
					distinct: ["searchTerm"],
				})
				.then((results) => results.length),
		]);

		logger.info(`\n📊 Database Stats:`);
		logger.info(`   - Total properties: ${totalProperties.toLocaleString()}`);
		logger.info(`   - Total scrape jobs: ${totalJobs.toLocaleString()}`);
		logger.info(
			`   - Distinct search terms: ${distinctTerms.toLocaleString()}`,
		);

		// Get success/failure breakdown
		const successfulJobs = await prisma.scrapeJob.count({
			where: { status: "completed", resultCount: { gt: 0 } },
		});

		const zeroResultJobs = await prisma.scrapeJob.count({
			where: { status: "completed", resultCount: 0 },
		});

		const successRate = totalJobs > 0 ? (successfulJobs / totalJobs) * 100 : 0;

		logger.info(`\n✅ Success Metrics:`);
		logger.info(`   - Successful jobs: ${successfulJobs.toLocaleString()}`);
		logger.info(`   - Zero-result jobs: ${zeroResultJobs.toLocaleString()}`);
		logger.info(`   - Failed jobs: ${failed}`);
		logger.info(`   - Success rate: ${successRate.toFixed(1)}%`);

		logger.info(`\n${"=".repeat(70)}`);

		await cleanup();
	});

/**
 * Helper function to cleanup connections
 */
async function cleanup() {
	await scraperQueue.close();
	await prisma.$disconnect();
}

// Handle errors and cleanup
process.on("SIGINT", async () => {
	logger.info("\n\n👋 Interrupted. Cleaning up...");
	await cleanup();
	process.exit(0);
});

process.on("unhandledRejection", async (reason: unknown) => {
	const error = reason instanceof Error ? reason : new Error(String(reason));
	logger.error(error, "\n❌ Unhandled error");
	await cleanup();
	process.exit(1);
});

// Parse arguments
program.parse();
