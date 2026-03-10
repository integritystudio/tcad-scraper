/**
 * Low-threshold variant of continuous-batch-scraper.
 * Lowers tier thresholds to squeeze remaining properties from the long tail.
 *
 * Tier 1: totalSearches=1, successRate=1, avgResultsPerSearch >= 20
 * Tier 2: totalSearches<=2, successRate>=0.5, avgResultsPerSearch >= 20
 * Tier 3: totalSearches<=3, successRate>=0.3, avgResultsPerSearch >= 50
 * Tier 4: Fallback pool from parent script
 *
 * Note: Does NOT apply HIGH_RESULT_TERM_SPLITS expansion. At low-threshold
 * thresholds (>=20 avg results), high-result terms like Oak/Maria/Estate are
 * unlikely to surface, and if they do they will be re-scraped as-is.
 *
 * Usage: doppler run -- npx tsx src/scripts/continuous-batch-scraper-lowthreshold.ts
 */

import winston from "winston";
import { config } from "../config";
import { prisma } from "../lib/prisma";
import { scraperQueue } from "../queues/scraper.queue";
import { getErrorMessage } from "../utils/error-helpers";
import { LOW_THRESHOLD_TIER_CONFIG, TermSelector } from "./continuous-batch-scraper";
import { enqueueBatch } from "./lib/queue-utils";
import { TARGET_2025_PROPERTY_COUNT as STOP_AT_PROPERTIES } from "./lib/backfill-constants";
const MAX_CONSECUTIVE_ZERO_BATCHES = 3;
const BATCH_SIZE = 25;
const DELAY_BETWEEN_BATCHES = 30000;
const CHECK_INTERVAL = 60000;

const logger = winston.createLogger({
	level: "info",
	format: winston.format.combine(
		winston.format.timestamp(),
		winston.format.simple(),
	),
	transports: [
		new winston.transports.Console(),
		new winston.transports.File({ filename: "logs/continuous-scraper-lowthreshold.log" }),
	],
});

class LowThresholdScraper {
	private termSelector = new TermSelector(LOW_THRESHOLD_TIER_CONFIG);
	private stats = {
		totalQueued: 0,
		batchesProcessed: 0,
		startTime: Date.now(),
		startingPropertyCount: 0,
	};
	private running = true;
	private monitorInterval: ReturnType<typeof setInterval> | null = null;
	private consecutiveZeroBatches = 0;
	private lastPropertyCount = 0;

	private countProperties() {
		return prisma.property.count({ where: { year: config.scraper.tcadYear } });
	}

	async run() {
		logger.info("=============================================");
		logger.info("  LOW-THRESHOLD CONTINUOUS SCRAPER (long tail)");
		logger.info("=============================================\n");

		const pendingCount = await scraperQueue.getWaitingCount();
		if (pendingCount > 0) {
			await scraperQueue.clean(0, "wait");
			logger.info(`Cleared ${pendingCount} pending jobs`);
		}

		this.stats.startingPropertyCount = await this.countProperties();
		this.lastPropertyCount = this.stats.startingPropertyCount;
		logger.info(`Starting: ${this.stats.startingPropertyCount.toLocaleString()}`);
		logger.info(`Stop at: ${STOP_AT_PROPERTIES.toLocaleString()} or ${MAX_CONSECUTIVE_ZERO_BATCHES} consecutive zero-result batches`);
		logger.info(`Remaining: ${(STOP_AT_PROPERTIES - this.stats.startingPropertyCount).toLocaleString()}\n`);

		process.on("SIGINT", () => this.stop());
		process.on("SIGTERM", () => this.stop());

		this.startMonitoring();

		while (this.running) {
			const currentCount = await this.countProperties();

			if (currentCount >= STOP_AT_PROPERTIES) {
				logger.info(`STOP TARGET REACHED! Current count: ${currentCount.toLocaleString()}`);
				break;
			}

			const newSinceLastCheck = currentCount - this.lastPropertyCount;
			if (this.stats.batchesProcessed > 0 && newSinceLastCheck === 0) {
				this.consecutiveZeroBatches++;
				logger.warn(`Zero new properties (${this.consecutiveZeroBatches}/${MAX_CONSECUTIVE_ZERO_BATCHES} consecutive)`);
				if (this.consecutiveZeroBatches >= MAX_CONSECUTIVE_ZERO_BATCHES) {
					logger.info(`STOPPING: ${MAX_CONSECUTIVE_ZERO_BATCHES} consecutive batches with zero new properties`);
					break;
				}
			} else if (newSinceLastCheck > 0) {
				this.consecutiveZeroBatches = 0;
			}
			this.lastPropertyCount = currentCount;

			const [waiting, active] = await Promise.all([
				scraperQueue.getWaitingCount(),
				scraperQueue.getActiveCount(),
			]);

			if (waiting + active < 100) {
				await this.queueBatch();
			} else {
				logger.info(`Queue full (${waiting} waiting, ${active} active). Waiting...`);
			}

			await this.delay(DELAY_BETWEEN_BATCHES);
		}

		await this.printFinalReport();
		await prisma.$disconnect();
		process.exit(0);
	}

	private async queueBatch() {
		const searchTerms = await this.termSelector.getNextBatch(BATCH_SIZE);
		this.stats.batchesProcessed++;

		logger.info(`Batch #${this.stats.batchesProcessed} (${searchTerms.length} terms)`);

		const enqueued = await enqueueBatch(searchTerms, "lowthreshold-batch", logger);
		this.stats.totalQueued += enqueued;

		logger.info(`Queued ${enqueued} jobs (Total: ${this.stats.totalQueued})`);
	}

	private startMonitoring() {
		this.monitorInterval = setInterval(async () => {
			try {
				const [currentCount, waiting, active, completed, failed] =
					await Promise.all([
						this.countProperties(),
						scraperQueue.getWaitingCount(),
						scraperQueue.getActiveCount(),
						scraperQueue.getCompletedCount(),
						scraperQueue.getFailedCount(),
					]);

				const newProperties = currentCount - this.stats.startingPropertyCount;
				const progress = (currentCount / STOP_AT_PROPERTIES) * 100;
				const elapsed = Math.floor((Date.now() - this.stats.startTime) / 1000);
				const hours = Math.floor(elapsed / 3600);
				const minutes = Math.floor((elapsed % 3600) / 60);
				const rate = newProperties / (elapsed / 60);

				logger.info(
					`[${hours}h ${minutes}m] ${progress.toFixed(2)}% | ` +
					`DB: ${currentCount.toLocaleString()} (+${newProperties.toLocaleString()}) | ` +
					`Queue: ${waiting}w/${active}a/${completed}c/${failed}f | ` +
					`${rate.toFixed(1)} props/min`,
				);

				if (rate > 0) {
					const remaining = STOP_AT_PROPERTIES - currentCount;
					const hoursRemaining = remaining / rate / 60;
					logger.info(`ETA: ${hoursRemaining.toFixed(1)} hours`);
				}
			} catch (error) {
				logger.error(`Monitoring error: ${getErrorMessage(error)}`);
			}
		}, CHECK_INTERVAL);
	}

	private async printFinalReport() {
		const finalCount = await this.countProperties();
		const elapsed = Math.floor((Date.now() - this.stats.startTime) / 1000);
		const hours = Math.floor(elapsed / 3600);
		const minutes = Math.floor((elapsed % 3600) / 60);

		logger.info("\n=== FINAL REPORT ===");
		logger.info(`Runtime: ${hours}h ${minutes}m`);
		logger.info(`Starting: ${this.stats.startingPropertyCount.toLocaleString()}`);
		logger.info(`Final: ${finalCount.toLocaleString()}`);
		logger.info(`Added: ${(finalCount - this.stats.startingPropertyCount).toLocaleString()}`);
		logger.info(`Jobs queued: ${this.stats.totalQueued.toLocaleString()}`);
		logger.info(`Batches: ${this.stats.batchesProcessed}`);
	}

	private stop() {
		logger.info("Stopping low-threshold scraper...");
		this.running = false;
		if (this.monitorInterval !== null) {
			clearInterval(this.monitorInterval);
			this.monitorInterval = null;
		}
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

if (require.main === module) {
	const scraper = new LowThresholdScraper();
	scraper.run().catch(async (error) => {
		logger.error(`Fatal error: ${getErrorMessage(error)}`);
		await prisma.$disconnect();
		process.exit(1);
	});
}
