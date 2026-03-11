#!/usr/bin/env npx tsx

/**
 * Data Cleaner CLI
 *
 * Consolidates data cleanup functionality:
 * - remove-all-duplicates.ts
 * - Future: filter-* and remove-* scripts
 */

import { Command } from "commander";
import { MIN_TERM_LENGTH, PROGRESS_LOG_INTERVAL } from "../utils/constants";
import logger from "../lib/logger";
import { prisma } from "../lib/prisma";
import { scraperQueue } from "../queues/scraper.queue";
import { removeDuplicatesFromQueue } from "../utils/deduplication";

interface CleanupOptions {
	dryRun?: boolean;
	threshold?: string;
	minAttempts?: string;
}

const program = new Command();

program
	.name("data-cleaner")
	.description("Clean and optimize database and queue data")
	.version("1.0.0");

// ============================================================================
// REMOVE DUPLICATES FROM QUEUE COMMAND
// ============================================================================
program
	.command("queue-duplicates")
	.description("Remove duplicate search terms from the queue")
	.option(
		"--dry-run",
		"Show what would be removed without actually removing",
		false,
	)
	.option("--quiet", "Suppress verbose output", false)
	.action(async (options) => {
		logger.info("🧹 Removing Duplicate Search Terms from Queue\n");
		logger.info("=".repeat(60));

		if (options.dryRun) {
			logger.info("🔍 Dry run mode - no changes will be made\n");

			// Analyze duplicates without removing
			const waitingJobs = await scraperQueue.getWaiting();
			const seenTerms = new Set<string>();
			const duplicates: typeof waitingJobs = [];

			waitingJobs.forEach((job) => {
				const term = job.data.searchTerm;
				if (seenTerms.has(term)) {
					duplicates.push(job);
				} else {
					seenTerms.add(term);
				}
			});

			logger.info(`\n📊 Analysis Results:`);
			logger.info(`   - Total waiting jobs: ${waitingJobs.length}`);
			logger.info(`   - Unique terms: ${seenTerms.size}`);
			logger.info(`   - Duplicate jobs: ${duplicates.length}`);

			if (duplicates.length > 0) {
				logger.info("\n📋 Sample duplicates (would be removed):");
				duplicates.slice(0, 10).forEach((job, idx) => {
					logger.info(`   ${idx + 1}. ${job.data.searchTerm} (job #${job.id})`);
				});
				logger.info("\nRun without --dry-run to actually remove duplicates.");
			}
		} else {
			// Use shared deduplication utility
			await removeDuplicatesFromQueue({
				verbose: !options.quiet,
				showProgress: !options.quiet,
			});
		}

		// Get updated queue stats
		const [waiting, active, delayed, completed, failedCount] =
			await Promise.all([
				scraperQueue.getWaitingCount(),
				scraperQueue.getActiveCount(),
				scraperQueue.getDelayedCount(),
				scraperQueue.getCompletedCount(),
				scraperQueue.getFailedCount(),
			]);

		logger.info(`\n📊 ${options.dryRun ? "Current" : "Final"} Queue Status:`);
		logger.info(`   - Waiting: ${waiting}`);
		logger.info(`   - Active: ${active}`);
		logger.info(`   - Delayed: ${delayed}`);
		logger.info(`   - Completed: ${completed}`);
		logger.info(`   - Failed: ${failedCount}`);

		if (!options.dryRun) {
			logger.info("\n🎉 All duplicates removed! Queue fully optimized.");
		}

		await cleanup();
	});

// ============================================================================
// REMOVE PROPERTY DUPLICATES COMMAND
// ============================================================================
program
	.command("property-duplicates")
	.description(
		"Identify and optionally remove duplicate properties in database",
	)
	.option("--dry-run", "Show duplicates without removing", true)
	.option("--remove", "Actually remove duplicates (use with caution)", false)
	.action(async (options) => {
		logger.info("🔍 Finding Duplicate Properties in Database\n");
		logger.info("=".repeat(60));

		// Find properties with duplicate property_id
		const duplicates = await prisma.$queryRaw<
			Array<{ property_id: string; count: bigint }>
		>`
      SELECT property_id, COUNT(*) as count
      FROM properties
      GROUP BY property_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;

		logger.info(`   Found ${duplicates.length} duplicate property_ids`);

		const totalDuplicates = duplicates.reduce(
			(sum, d) => sum + Number(d.count) - 1,
			0,
		);
		logger.info(`   Total duplicate records to remove: ${totalDuplicates}`);

		if (options.dryRun) {
			logger.info("\n📋 DRY RUN - Sample duplicates (would be removed):");
			duplicates.slice(0, 10).forEach((dup, idx) => {
				logger.info(
					`   ${idx + 1}. Property ID: ${dup.property_id} (${Number(dup.count)} copies)`,
				);
			});
			logger.info("\nRun without --dry-run to actually remove duplicates.");
			await cleanup();
			return;
		}

		// Remove duplicates - keep the oldest record
		logger.info(
			"\n🗑️  Removing duplicates (keeping oldest record for each property_id)...",
		);

		let removed = 0;
		for (const dup of duplicates) {
			// Get all records for this property_id
			const records = await prisma.property.findMany({
				where: { propertyId: dup.property_id },
				orderBy: { createdAt: "asc" },
			});

			// Delete all but the first (oldest)
			const toDelete = records.slice(1).map((r) => r.id);

			if (toDelete.length > 0) {
				await prisma.property.deleteMany({
					where: { id: { in: toDelete } },
				});
				removed += toDelete.length;

				if (removed % PROGRESS_LOG_INTERVAL === 0) {
					process.stdout.write(
						`\r   Progress: ${removed}/${totalDuplicates} removed`,
					);
				}
			}
		}

		logger.info(`\n\n✅ Removed ${removed} duplicate properties!`);

		// Show final stats
		const totalProperties = await prisma.property.count();
		logger.info(
			`\n📊 Final property count: ${totalProperties.toLocaleString()}`,
		);

		await cleanup();
	});

// ============================================================================
// REMOVE INEFFICIENT SEARCH TERMS COMMAND
// ============================================================================
program
	.command("inefficient-terms")
	.description("Remove search terms with consistently low results")
	.option(
		"--threshold <n>",
		"Max average results to be considered inefficient",
		"5",
	)
	.option(
		"--min-attempts <n>",
		"Minimum attempts before considering term inefficient",
		"2",
	)
	.option("--dry-run", "Show what would be removed without removing")
	.action(async (options: CleanupOptions) => {
		logger.info("🧹 Removing Inefficient Search Terms\n");
		logger.info("=".repeat(70));

		const threshold = parseInt(options.threshold || "5", 10);
		const minAttempts = parseInt(options.minAttempts || "2", 10);

		logger.info(`\n📊 Criteria:`);
		logger.info(`   - Average results <= ${threshold} properties`);
		logger.info(`   - Minimum ${minAttempts} scrape attempts`);

		// Find terms and their average results
		const termStats = await prisma.scrapeJob.groupBy({
			by: ["searchTerm"],
			where: {
				status: "completed",
			},
			_count: true,
			_avg: {
				resultCount: true,
			},
		});

		const inefficientTerms = termStats.filter(
			(stat) =>
				stat._count >= minAttempts && (stat._avg.resultCount || 0) <= threshold,
		);

		logger.info(`\n📊 Analyzed ${termStats.length} search terms`);
		logger.info(`📊 Inefficient terms found: ${inefficientTerms.length}`);

		if (inefficientTerms.length === 0) {
			logger.info("\n✅ No inefficient terms found!");
			await cleanup();
			return;
		}

		if (options.dryRun) {
			logger.info(
				"\n📋 DRY RUN - Sample inefficient terms (would be removed):",
			);
			inefficientTerms.slice(0, 20).forEach((stat, idx) => {
				logger.info(
					`   ${idx + 1}. "${stat.searchTerm}" - avg: ${(stat._avg.resultCount || 0).toFixed(1)} properties (${stat._count} attempts)`,
				);
			});
			logger.info("\nRun without --dry-run to actually remove these terms.");
			await cleanup();
			return;
		}

		// Remove from database
		const inefficientTermsList = inefficientTerms.map((t) => t.searchTerm);
		logger.info(
			`\n🗑️  Removing ${inefficientTermsList.length} inefficient terms from database...`,
		);

		await prisma.scrapeJob.deleteMany({
			where: {
				searchTerm: { in: inefficientTermsList },
			},
		});

		logger.info(`✅ Removed from database!`);

		// Remove from queue
		const waitingJobs = await scraperQueue.getWaiting();
		const inefficientQueueJobs = waitingJobs.filter((job) =>
			inefficientTermsList.includes(job.data.searchTerm),
		);

		if (inefficientQueueJobs.length > 0) {
			logger.info(
				`\n🔍 Found ${inefficientQueueJobs.length} inefficient terms in queue, removing...`,
			);

			let removed = 0;
			for (const job of inefficientQueueJobs) {
				try {
					await job.remove();
					removed++;
					if (removed % 50 === 0) {
						process.stdout.write(
							`\r   Progress: ${removed}/${inefficientQueueJobs.length}`,
						);
					}
				} catch (_error) {
					// Ignore errors
				}
			}

			logger.info(`\n   ✅ Removed ${removed} from queue!`);
		}

		await cleanup();
	});

// ============================================================================
// CLEAN SEARCH TERMS COMMAND
// ============================================================================
program
	.command("search-terms")
	.description("Remove problematic search terms from database")
	.option("--short", "Remove terms shorter than 4 characters", false)
	.option("--numbers", "Remove numeric-only terms (ZIP codes)", false)
	.option("--compounds", "Remove compound names (first + last)", false)
	.option("--cities", "Remove city names", false)
	.option("--dry-run", "Show what would be removed without removing", false)
	.action(async (options) => {
		logger.info("🧹 Cleaning Problematic Search Terms\n");
		logger.info("=".repeat(60));

		const filters: string[] = [];
		const allTerms = await prisma.scrapeJob.findMany({
			select: { searchTerm: true },
			distinct: ["searchTerm"],
		});

		const termsToRemove = new Set<string>();

		// Apply filters
		if (options.short) {
			filters.push(`short terms (< ${MIN_TERM_LENGTH} chars)`);
			allTerms.forEach((t) => {
				if (t.searchTerm.length < MIN_TERM_LENGTH) {
					termsToRemove.add(t.searchTerm);
				}
			});
		}

		if (options.numbers) {
			filters.push("numeric terms (ZIP codes)");
			allTerms.forEach((t) => {
				if (/^\d+$/.test(t.searchTerm)) {
					termsToRemove.add(t.searchTerm);
				}
			});
		}

		if (options.compounds) {
			filters.push("compound names");
			allTerms.forEach((t) => {
				const words = t.searchTerm.split(/\s+/);
				if (
					words.length >= 2 &&
					/^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(t.searchTerm)
				) {
					termsToRemove.add(t.searchTerm);
				}
			});
		}

		if (options.cities) {
			filters.push("city names");
			const cityNames = [
				"Austin",
				"Lakeway",
				"Manor",
				"Pflugerville",
				"Cedar Park",
				"Round Rock",
				"Georgetown",
				"Leander",
				"Kyle",
				"Buda",
			];
			allTerms.forEach((t) => {
				if (cityNames.includes(t.searchTerm)) {
					termsToRemove.add(t.searchTerm);
				}
			});
		}

		logger.info(`\n🎯 Filters applied: ${filters.join(", ")}`);
		logger.info(`📊 Terms to remove: ${termsToRemove.size}\n`);

		if (termsToRemove.size === 0) {
			logger.info("✅ No terms match the selected filters");
			await cleanup();
			return;
		}

		if (options.dryRun) {
			logger.info("\n📋 DRY RUN - Sample terms (would be removed):");
			Array.from(termsToRemove)
				.slice(0, 20)
				.forEach((term, idx) => {
					logger.info(`   ${idx + 1}. "${term}"`);
				});
			logger.info("\nRun without --dry-run to actually remove these terms.");
			await cleanup();
			return;
		}

		// Convert Set to Array for database operations
		const termsArray = Array.from(termsToRemove);

		// Remove from database
		logger.info(`\n🗑️  Removing ${termsArray.length} terms from database...`);

		await prisma.scrapeJob.deleteMany({
			where: {
				searchTerm: { in: termsArray },
			},
		});

		logger.info(`✅ Removed from database!`);

		// Remove from queue
		const waitingJobs = await scraperQueue.getWaiting();
		const queueJobsToRemove = waitingJobs.filter((job) =>
			termsToRemove.has(job.data.searchTerm),
		);

		if (queueJobsToRemove.length > 0) {
			logger.info(
				`\n🔍 Found ${queueJobsToRemove.length} matching terms in queue, removing...`,
			);

			let removed = 0;
			for (const job of queueJobsToRemove) {
				try {
					await job.remove();
					removed++;
					if (removed % 50 === 0) {
						process.stdout.write(
							`\r   Progress: ${removed}/${queueJobsToRemove.length}`,
						);
					}
				} catch (_error) {
					// Ignore errors
				}
			}

			logger.info(`\n   ✅ Removed ${removed} from queue!`);
		}

		await cleanup();
	});

/**
 * Comprehensive cleanup - all filters
 */
program
	.command("all")
	.description(
		"Run all cleanup operations (short, numeric, duplicates, inefficient)",
	)
	.option("--dry-run", "Show what would be done without actually doing it")
	.action(async (options: CleanupOptions) => {
		logger.info("🧹 COMPREHENSIVE DATA CLEANUP\n");
		logger.info("=".repeat(70));

		if (options.dryRun) {
			logger.info("\n⚠️  DRY RUN MODE - No data will be modified\n");
		}

		logger.info("\n1️⃣  Removing short terms...");
		// Run short-terms command
		await program.parseAsync([
			"node",
			"data-cleaner",
			"short-terms",
			...(options.dryRun ? ["--dry-run"] : []),
		]);

		logger.info("\n2️⃣  Removing numeric terms...");
		// Run numeric-terms command
		await program.parseAsync([
			"node",
			"data-cleaner",
			"numeric-terms",
			...(options.dryRun ? ["--dry-run"] : []),
		]);

		logger.info("\n3️⃣  Removing queue duplicates...");
		// Run queue-duplicates command (no dry-run support)
		if (!options.dryRun) {
			await program.parseAsync(["node", "data-cleaner", "queue-duplicates"]);
		}

		logger.info("\n4️⃣  Removing property duplicates...");
		// Run properties-duplicates command
		await program.parseAsync([
			"node",
			"data-cleaner",
			"properties-duplicates",
			...(options.dryRun ? ["--dry-run"] : []),
		]);

		logger.info("\n✅ Comprehensive cleanup complete!");

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
