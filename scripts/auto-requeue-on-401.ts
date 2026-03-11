#!/usr/bin/env npx tsx

/**
 * Automatic 401 Error Handler with Token Refresh
 *
 * This script:
 * 1. Monitors the database for 401 errors
 * 2. Automatically refreshes the API token when 401 detected
 * 3. Re-enqueues failed jobs in small batches (50 at a time)
 * 4. Continues monitoring for new 401 errors
 */

import logger from "../server/src/lib/logger";
import { prisma } from "../server/src/lib/prisma";
import { scraperQueue } from "../server/src/queues/scraper.queue";
import { tokenRefreshService } from "../server/src/services/token-refresh.service";
import { getErrorMessage } from "../server/src/utils/error-helpers";

const BATCH_SIZE = 50; // Enqueue 50 jobs at a time
const CHECK_INTERVAL_MS = 60000; // Check every 1 minute
const TOKEN_REFRESH_INTERVAL_MS = 3 * 60 * 1000; // Refresh token every 3 minutes

let lastCheck = new Date();
let isProcessing = false;
let consecutiveErrorCount = 0;

async function check401Errors() {
	if (isProcessing) {
		logger.info("Already processing 401 errors, skipping this check...");
		return;
	}

	try {
		isProcessing = true;

		// Check for recent 401 errors since last check
		const recentErrors = await prisma.scrapeJob.count({
			where: {
				status: "failed",
				error: {
					contains: "HTTP 401",
				},
				startedAt: {
					gte: lastCheck,
				},
			},
		});

		if (recentErrors > 0) {
			logger.warn(
				`⚠️  Detected ${recentErrors} new 401 errors since last check!`,
			);
			consecutiveErrorCount++;

			// Refresh token immediately
			logger.info("🔑 Refreshing API token due to 401 errors...");
			const newToken = await tokenRefreshService.refreshToken();

			if (!newToken) {
				logger.error("❌ Failed to refresh token!");
				return;
			}

			logger.info(
				`✅ Token refreshed successfully (length: ${newToken.length})`,
			);

			// Get all failed jobs with 401 errors
			const failedJobs = await prisma.scrapeJob.findMany({
				where: {
					status: "failed",
					error: {
						contains: "HTTP 401",
					},
				},
				select: { searchTerm: true },
				distinct: ["searchTerm"],
				orderBy: { startedAt: "desc" },
			});

			const termsToRequeue = Array.from(
				new Set(failedJobs.map((j) => j.searchTerm)),
			);
			logger.info(
				`📋 Found ${termsToRequeue.length} unique terms with 401 errors`,
			);

			// Clean up failed jobs from queue first
			const cleanedCount = await scraperQueue.clean(0, "failed");
			logger.info(`🧹 Cleaned ${cleanedCount.length} failed jobs from queue`);

			// Re-enqueue in batches
			logger.info(
				`🚀 Re-enqueueing ${termsToRequeue.length} jobs in batches of ${BATCH_SIZE}...`,
			);

			for (let i = 0; i < termsToRequeue.length; i += BATCH_SIZE) {
				const batch = termsToRequeue.slice(i, i + BATCH_SIZE);
				const batchNum = Math.floor(i / BATCH_SIZE) + 1;
				const totalBatches = Math.ceil(termsToRequeue.length / BATCH_SIZE);

				logger.info(
					`   Batch ${batchNum}/${totalBatches}: Enqueueing ${batch.length} jobs...`,
				);

				for (const term of batch) {
					try {
						await scraperQueue.add(
							"scrape-properties",
							{
								searchTerm: term,
								userId: "auto-requeue-401",
								scheduled: false,
							},
							{
								priority: 3, // Higher priority for re-queued jobs
								attempts: 3,
								backoff: {
									type: "exponential",
									delay: 2000,
								},
								removeOnComplete: false,
								removeOnFail: false,
							},
						);
					} catch (error: unknown) {
						logger.error(
							`   ❌ Failed to enqueue "${term}": ${getErrorMessage(error)}`,
						);
					}
				}

				logger.info(`   ✅ Batch ${batchNum}/${totalBatches} enqueued`);

				// Small delay between batches to avoid overwhelming the queue
				if (i + BATCH_SIZE < termsToRequeue.length) {
					await new Promise((resolve) => setTimeout(resolve, 1000));
				}
			}

			logger.info(
				`✅ Re-enqueued all ${termsToRequeue.length} jobs successfully`,
			);

			// Reset consecutive error count after successful requeue
			consecutiveErrorCount = 0;
		} else {
			logger.info(
				`✅ No new 401 errors detected (checked ${recentErrors} jobs)`,
			);
			consecutiveErrorCount = 0;
		}

		// Update last check time
		lastCheck = new Date();
	} catch (error) {
		logger.error(`❌ Error checking for 401 errors: ${getErrorMessage(error)}`);
		consecutiveErrorCount++;

		// If we've had too many consecutive errors, try refreshing token anyway
		if (consecutiveErrorCount >= 3) {
			logger.warn("⚠️  Too many consecutive errors, forcing token refresh...");
			await tokenRefreshService.refreshToken();
			consecutiveErrorCount = 0;
		}
	} finally {
		isProcessing = false;
	}
}

async function showStatus() {
	const [waiting, active, delayed, failed, completed] = await Promise.all([
		scraperQueue.getWaitingCount(),
		scraperQueue.getActiveCount(),
		scraperQueue.getDelayedCount(),
		scraperQueue.getFailedCount(),
		scraperQueue.getCompletedCount(),
	]);

	const tokenStats = tokenRefreshService.getStats();

	logger.info("\n📊 Status Update:");
	logger.info("   Queue:");
	logger.info(`     - Waiting: ${waiting}`);
	logger.info(`     - Active: ${active}`);
	logger.info(`     - Delayed: ${delayed}`);
	logger.info(`     - Failed: ${failed}`);
	logger.info(`     - Completed: ${completed}`);
	logger.info("   Token:");
	logger.info(`     - Last refresh: ${tokenStats.lastRefreshTime}`);
	logger.info(`     - Success count: ${tokenStats.successCount}`);
	logger.info(`     - Failure count: ${tokenStats.failureCount}`);
}

async function main() {
	logger.info("🤖 Auto-Requeue on 401 Handler Starting");
	logger.info("=".repeat(60));
	logger.info(`   Check interval: ${CHECK_INTERVAL_MS / 1000}s`);
	logger.info(
		`   Token refresh interval: ${TOKEN_REFRESH_INTERVAL_MS / 1000}s`,
	);
	logger.info(`   Batch size: ${BATCH_SIZE} jobs`);
	logger.info("=".repeat(60));

	// Initial token refresh
	logger.info("\n🔑 Performing initial token refresh...");
	const initialToken = await tokenRefreshService.refreshToken();

	if (!initialToken) {
		logger.error("❌ Failed to get initial token!");
		process.exit(1);
	}

	logger.info("✅ Initial token acquired");

	// Start automatic token refresh every 3 minutes
	logger.info("\n⏰ Starting automatic token refresh (every 3 minutes)...");
	tokenRefreshService.startAutoRefreshInterval(TOKEN_REFRESH_INTERVAL_MS);
	logger.info("✅ Auto-refresh started");

	// Show initial status
	await showStatus();

	// Start monitoring loop
	logger.info("\n👀 Starting 401 error monitoring loop...");
	logger.info("   Press Ctrl+C to stop\n");

	// Initial check
	await check401Errors();

	// Set up periodic checks
	const checkInterval = setInterval(async () => {
		logger.info("\n🔍 Running periodic 401 error check...");
		await check401Errors();
		await showStatus();
	}, CHECK_INTERVAL_MS);

	// Graceful shutdown
	process.on("SIGINT", async () => {
		logger.info("\n\n👋 Shutting down...");
		clearInterval(checkInterval);
		await cleanup();
		process.exit(0);
	});

	process.on("SIGTERM", async () => {
		logger.info("\n\n👋 Shutting down...");
		clearInterval(checkInterval);
		await cleanup();
		process.exit(0);
	});

	// Keep process alive
	await new Promise(() => {});
}

async function cleanup() {
	logger.info("Cleaning up...");
	await tokenRefreshService.cleanup();
	await scraperQueue.close();
	await prisma.$disconnect();
	logger.info("Cleanup complete");
}

main().catch(async (error) => {
	logger.error("Fatal error:", error);
	await cleanup();
	process.exit(1);
});
