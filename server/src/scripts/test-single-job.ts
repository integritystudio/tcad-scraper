#!/usr/bin/env node

/**
 * Test Single Job
 * Enqueues a single test job and monitors its progress
 */

import logger from "../lib/logger";
import { scraperQueue } from "../queues/scraper.queue";

async function testSingleJob() {
	const searchTerm = "Development";

	logger.info(`📋 Enqueueing test job for: "${searchTerm}"`);

	try {
		const job = await scraperQueue.add(
			"scrape-properties",
			{
				searchTerm,
				userId: "test-single-job",
				scheduled: false,
			},
			{
				attempts: 3,
				backoff: {
					type: "exponential",
					delay: 2000,
				},
				priority: 1,
			},
		);

		logger.info(`✅ Job enqueued: ID ${job.id}`);
		logger.info(`⏳ Waiting for job to complete...`);

		// Wait for job to finish
		const result = await job.finished();

		logger.info(`✅ Job completed successfully!`);
		logger.info(`   Properties found: ${result.count}`);
		logger.info(`   Duration: ${result.duration}ms`);

		if (result.properties && result.properties.length > 0) {
			logger.info(
				`   Sample property: ${JSON.stringify(result.properties[0], null, 2)}`,
			);
		}

		process.exit(0);
	} catch (error) {
		logger.error({ err: error }, `❌ Job failed:`);
		process.exit(1);
	}
}

testSingleJob();
