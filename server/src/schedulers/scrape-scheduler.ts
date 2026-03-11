import cron from "node-cron";
import logger from "../lib/logger";
import { prisma } from "../lib/prisma";
import { scraperQueue } from "../queues/scraper.queue";
import { MS_PER_MINUTE, QUEUE_RETENTION_DAYS, SCRAPE_BACKOFF_DELAY_MS, SCRAPE_JOB_ATTEMPTS, SCRAPE_JOB_RETENTION_DAYS } from "../utils/constants";
import { getErrorMessage } from "../utils/error-helpers";

const SCRAPE_JITTER_MAX_MS = MS_PER_MINUTE;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

class ScheduledJobs {
	private tasks: cron.ScheduledTask[] = [];

	initialize() {
		logger.info("Initializing scheduled jobs...");

		// Daily scrape at 2 AM for monitored searches
		const dailyTask = cron.schedule(
			"0 2 * * *",
			async () => {
				await this.runScheduledScrapes("daily");
			},
			{
				scheduled: false,
				timezone: "America/Chicago",
			},
		);

		// Weekly scrape on Sundays at 3 AM
		const weeklyTask = cron.schedule(
			"0 3 * * 0",
			async () => {
				await this.runScheduledScrapes("weekly");
			},
			{
				scheduled: false,
				timezone: "America/Chicago",
			},
		);

		// Monthly scrape on the 1st at 4 AM
		const monthlyTask = cron.schedule(
			"0 4 1 * *",
			async () => {
				await this.runScheduledScrapes("monthly");
			},
			{
				scheduled: false,
				timezone: "America/Chicago",
			},
		);

		// Clean up old jobs every hour
		const cleanupTask = cron.schedule(
			"0 * * * *",
			async () => {
				await this.cleanupOldJobs();
			},
			{
				scheduled: false,
			},
		);

		this.tasks = [dailyTask, weeklyTask, monthlyTask, cleanupTask];

		// Start all tasks
		this.tasks.forEach((task) => task.start());

		logger.info("Scheduled jobs initialized successfully");
	}

	private async runScheduledScrapes(frequency: string) {
		try {
			logger.info(`Running ${frequency} scheduled scrapes...`);

			const monitoredSearches = await prisma.monitoredSearch.findMany({
				where: {
					active: true,
					frequency,
				},
			});

			logger.info(
				`Found ${monitoredSearches.length} ${frequency} searches to run`,
			);

			for (const search of monitoredSearches) {
				// Add random delay to avoid overwhelming the target site
				const delay = Math.floor(Math.random() * SCRAPE_JITTER_MAX_MS);

				await scraperQueue.add(
					"scrape-properties",
					{
						searchTerm: search.searchTerm,
						scheduled: true,
					},
					{
						delay,
						attempts: SCRAPE_JOB_ATTEMPTS,
						backoff: {
							type: "exponential",
							delay: SCRAPE_BACKOFF_DELAY_MS,
						},
					},
				);

				// Update last run time
				await prisma.monitoredSearch.update({
					where: { id: search.id },
					data: { lastRun: new Date() },
				});

				logger.info(
					`Scheduled scrape for "${search.searchTerm}" with ${delay}ms delay`,
				);
			}
		} catch (error) {
			logger.error(
				`Failed to run ${frequency} scheduled scrapes: %s`,
				getErrorMessage(error),
			);
		}
	}

	private async cleanupOldJobs() {
		try {
			logger.info("Cleaning up old jobs...");

			// Delete scrape jobs older than retention period
			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - SCRAPE_JOB_RETENTION_DAYS);

			const deletedJobs = await prisma.scrapeJob.deleteMany({
				where: {
					completedAt: {
						lt: cutoffDate,
					},
				},
			});

			// Clean Bull queue completed/failed jobs older than queue retention period
			const queueRetentionMs = QUEUE_RETENTION_DAYS * MS_PER_DAY;
			await scraperQueue.clean(queueRetentionMs, "completed");
			await scraperQueue.clean(queueRetentionMs, "failed");

			logger.info(`Cleaned up ${deletedJobs.count} old database jobs`);
		} catch (error) {
			logger.error("Failed to clean up old jobs: %s", getErrorMessage(error));
		}
	}

	stop() {
		logger.info("Stopping scheduled jobs...");
		this.tasks.forEach((task) => task.stop());
		logger.info("Scheduled jobs stopped");
	}

	// Manual trigger for testing
	async triggerDailyScrapes() {
		await this.runScheduledScrapes("daily");
	}
}

export const scheduledJobs = new ScheduledJobs();
