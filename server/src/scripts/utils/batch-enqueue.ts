/**
 * Generic Batch Enqueue Utility
 * Consolidates common logic for enqueuing batch search terms
 */

import { config } from "../../config";
import logger from "../../lib/logger";
import { scraperQueue } from "../../queues/scraper.queue";

export interface BatchEnqueueConfig {
	/** Display name for the batch (e.g., "Corporation", "Residential") */
	batchName: string;
	/** Emoji to display in logs (e.g., "🏛️", "🏠") */
	emoji: string;
	/** Array of search terms to enqueue */
	terms: string[];
	/** User ID for job attribution */
	userId: string;
	/** Job priority (default: undefined) */
	priority?: number;
	/** Additional log messages to display after initial logs */
	extraLogs?: () => void;
}

export interface BatchEnqueueResult {
	successCount: number;
	failCount: number;
	totalTerms: number;
}

/**
 * Enqueue a batch of search terms with consistent error handling and logging
 *
 * @param batchConfig - Batch configuration options
 * @returns Result summary with success/fail counts
 *
 * @example
 * ```typescript
 * await enqueueBatchGeneric({
 *   batchName: 'Corporation',
 *   emoji: '🏛️',
 *   terms: ['Corp', 'Inc', 'LLC'],
 *   userId: 'corporation-batch-enqueue',
 *   priority: 2
 * });
 * ```
 */
export async function enqueueBatchGeneric(
	batchConfig: BatchEnqueueConfig,
): Promise<BatchEnqueueResult> {
	const { batchName, emoji, terms, userId, priority, extraLogs } = batchConfig;

	logger.info(`${emoji} Starting ${batchName} Batch Enqueue`);
	logger.info(`Auto-refresh token enabled: ${config.scraper.autoRefreshToken}`);

	// Call extra logs if provided
	if (extraLogs) {
		extraLogs();
	}

	try {
		let successCount = 0;
		let failCount = 0;

		for (const term of terms) {
			try {
				const job = await scraperQueue.add(
					"scrape-properties",
					{
						searchTerm: term,
						userId,
						scheduled: true,
					},
					{
						attempts: 3,
						backoff: {
							type: "exponential",
							delay: 2000,
						},
						...(priority !== undefined && { priority }),
						removeOnComplete: 100,
						removeOnFail: 50,
					},
				);

				successCount++;
				logger.info(
					`✅ [${successCount}/${terms.length}] Queued: "${term}" (Job ID: ${job.id})`,
				);
			} catch (error) {
				failCount++;
				logger.error({ err: error }, `❌ Failed to queue "${term}":`);
			}
		}

		logger.info(`\n📊 Summary: ${successCount} queued, ${failCount} failed`);
		logger.info(`✨ ${batchName} batch enqueue completed!`);

		return {
			successCount,
			failCount,
			totalTerms: terms.length,
		};
	} catch (error) {
		logger.error({ err: error }, "❌ Fatal error:");
		throw error;
	}
}
