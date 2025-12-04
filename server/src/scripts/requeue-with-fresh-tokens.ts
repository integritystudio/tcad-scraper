#!/usr/bin/env npx tsx

/**
 * Re-queue Script with Fresh Token Refresh
 *
 * This script:
 * 1. Stops all pending jobs
 * 2. Collects all failed jobs from the database
 * 3. Refreshes the API token
 * 4. Re-enqueues all jobs with fresh tokens
 * 5. Sets up auto-refresh every 3 minutes
 */

import logger from "../lib/logger";
import { prisma } from "../lib/prisma";
import { scraperQueue } from "../queues/scraper.queue";
import { tokenRefreshService } from "../services/token-refresh.service";

const THREE_MINUTES_MS = 3 * 60 * 1000; // 3 minutes in milliseconds

async function main() {
	logger.info("🔄 Re-queue Script with Fresh Token Refresh");
	logger.info("=".repeat(60));

	try {
		// Step 1: Get current queue status
		logger.info("\n📊 Step 1: Checking current queue status...");
		const [waiting, active, delayed, failedCount, completed] =
			await Promise.all([
				scraperQueue.getWaitingCount(),
				scraperQueue.getActiveCount(),
				scraperQueue.getDelayedCount(),
				scraperQueue.getFailedCount(),
				scraperQueue.getCompletedCount(),
			]);

		logger.info(`   - Waiting: ${waiting}`);
		logger.info(`   - Active: ${active}`);
		logger.info(`   - Delayed: ${delayed}`);
		logger.info(`   - Failed in queue: ${failedCount}`);
		logger.info(`   - Completed: ${completed}`);

		// Step 2: Collect all search terms to re-queue
		logger.info("\n📋 Step 2: Collecting jobs to re-queue...");

		// Get pending jobs from queue
		const waitingJobs = await scraperQueue.getWaiting();
		const delayedJobs = await scraperQueue.getDelayed();
		const failedJobs = await scraperQueue.getFailed();

		const pendingTerms = new Set<string>();
		[...waitingJobs, ...delayedJobs].forEach((job) => {
			if (job.data.searchTerm) {
				pendingTerms.add(job.data.searchTerm);
			}
		});

		// Get failed jobs from database
		const dbFailedJobs = await prisma.scrapeJob.findMany({
			where: {
				status: "failed",
				error: {
					contains: "HTTP 401",
				},
			},
			select: { searchTerm: true },
			distinct: ["searchTerm"],
			orderBy: { startedAt: "desc" },
			take: 500,
		});

		const failedTerms = new Set<string>();
		dbFailedJobs.forEach((job) => {
			failedTerms.add(job.searchTerm);
		});

		// Also add queue failed jobs
		failedJobs.forEach((job) => {
			if (job.data.searchTerm) {
				failedTerms.add(job.data.searchTerm);
			}
		});

		// Combine all unique terms
		const allTerms = Array.from(new Set([...pendingTerms, ...failedTerms]));

		logger.info(`   - Pending terms from queue: ${pendingTerms.size}`);
		logger.info(`   - Failed terms (401 errors): ${failedTerms.size}`);
		logger.info(`   - Total unique terms to re-queue: ${allTerms.length}`);

		if (allTerms.length === 0) {
			logger.info("\n✅ No jobs to re-queue!");
			await cleanup();
			return;
		}

		// Step 3: Stop and clear pending jobs
		logger.info("\n🛑 Step 3: Stopping and clearing pending jobs...");
		let removed = 0;

		// Remove waiting jobs
		for (const job of waitingJobs) {
			try {
				await job.remove();
				removed++;
				if (removed % 50 === 0) {
					process.stdout.write(
						`\r   Removed: ${removed}/${waitingJobs.length + delayedJobs.length}`,
					);
				}
			} catch (error: unknown) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				logger.error(`   Failed to remove job ${job.id}: ${errorMessage}`);
			}
		}

		// Remove delayed jobs
		for (const job of delayedJobs) {
			try {
				await job.remove();
				removed++;
				if (removed % 50 === 0) {
					process.stdout.write(
						`\r   Removed: ${removed}/${waitingJobs.length + delayedJobs.length}`,
					);
				}
			} catch (error: unknown) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				logger.error(`   Failed to remove job ${job.id}: ${errorMessage}`);
			}
		}

		logger.info(`\n   ✅ Removed ${removed} pending jobs`);

		// Step 4: Clean up failed jobs from queue
		logger.info("\n🧹 Step 4: Cleaning up failed jobs from queue...");
		const cleanedFailed = await scraperQueue.clean(0, "failed");
		logger.info(`   ✅ Cleaned ${cleanedFailed.length} failed jobs`);

		// Step 5: Refresh token
		logger.info("\n🔑 Step 5: Refreshing API token...");
		const newToken = await tokenRefreshService.refreshToken();

		if (!newToken) {
			logger.error("   ❌ Failed to refresh token!");
			await cleanup();
			process.exit(1);
		}

		logger.info(
			`   ✅ Token refreshed successfully (length: ${newToken.length})`,
		);
		logger.info(`   Preview: ${newToken.substring(0, 50)}...`);

		// Step 6: Start auto-refresh every 3 minutes
		logger.info("\n⏰ Step 6: Starting auto-refresh (every 3 minutes)...");
		tokenRefreshService.startAutoRefreshInterval(THREE_MINUTES_MS);
		logger.info("   ✅ Auto-refresh started");

		// Step 7: Re-enqueue all jobs with priority
		logger.info(`\n🚀 Step 7: Re-enqueueing ${allTerms.length} jobs...`);
		let enqueued = 0;

		for (const term of allTerms) {
			try {
				await scraperQueue.add(
					"scrape-properties",
					{
						searchTerm: term,
						userId: "cli-requeue-script",
						scheduled: false,
					},
					{
						priority: 5, // Medium priority
						attempts: 3,
						backoff: {
							type: "exponential",
							delay: 2000,
						},
						removeOnComplete: false,
						removeOnFail: false,
					},
				);
				enqueued++;

				if (enqueued % 50 === 0) {
					process.stdout.write(
						`\r   Progress: ${enqueued}/${allTerms.length} (${((enqueued / allTerms.length) * 100).toFixed(1)}%)`,
					);
				}
			} catch (error: unknown) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				logger.error(`\n   ❌ Failed to enqueue "${term}": ${errorMessage}`);
			}
		}

		logger.info(`\n   ✅ Enqueued ${enqueued} jobs`);

		// Step 8: Show final status
		logger.info("\n📊 Step 8: Final queue status...");
		const [finalWaiting, finalActive, finalDelayed] = await Promise.all([
			scraperQueue.getWaitingCount(),
			scraperQueue.getActiveCount(),
			scraperQueue.getDelayedCount(),
		]);

		logger.info(`   - Waiting: ${finalWaiting}`);
		logger.info(`   - Active: ${finalActive}`);
		logger.info(`   - Delayed: ${finalDelayed}`);
		logger.info(`   - Total: ${finalWaiting + finalActive + finalDelayed}`);

		logger.info("\n✅ Re-queue complete!");
		logger.info("\n⚠️  IMPORTANT: Auto-refresh is running every 3 minutes.");
		logger.info(
			"   The script will continue running to maintain token refresh.",
		);
		logger.info("   Press Ctrl+C to stop when done.\n");

		// Keep the script running to maintain auto-refresh
		process.on("SIGINT", async () => {
			logger.info("\n\n👋 Shutting down...");
			await cleanup();
			process.exit(0);
		});

		// Keep process alive
		await new Promise(() => {});
	} catch (error) {
		logger.error(error as Error, "\n❌ Script failed");
		await cleanup();
		process.exit(1);
	}
}

async function cleanup() {
	logger.info("Cleaning up...");
	await tokenRefreshService.cleanup();
	await scraperQueue.close();
	await prisma.$disconnect();
}

main().catch(async (error) => {
	logger.error("Fatal error:", error);
	await cleanup();
	process.exit(1);
});
