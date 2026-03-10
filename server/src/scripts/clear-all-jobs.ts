import logger from "../lib/logger";
import { scraperQueue } from "../queues/scraper.queue";

async function clearAllJobs() {
	try {
		logger.info("Starting to clear all jobs from the queue...");

		// Get counts before clearing
		const counts = await scraperQueue.getJobCounts();
		logger.info({ counts }, "Current job counts");

		// Clear all jobs by status
		await scraperQueue.empty(); // Removes waiting and delayed jobs
		logger.info("Cleared waiting and delayed jobs");

		// Clean completed and failed jobs (0 grace period = remove all)
		await scraperQueue.clean(0, "completed");
		logger.info("Cleaned all completed jobs");

		await scraperQueue.clean(0, "failed");
		logger.info("Cleaned all failed jobs");

		// Get the active jobs and remove them
		const activeJobs = await scraperQueue.getActive();
		for (const job of activeJobs) {
			await job.remove();
		}
		logger.info(`Removed ${activeJobs.length} active jobs`);

		// Verify all jobs are removed
		const finalCounts = await scraperQueue.getJobCounts();
		logger.info({ counts: finalCounts }, "Final job counts");

		logger.info("Successfully cleared all jobs from the queue");
		process.exit(0);
	} catch (error) {
		logger.error({ err: error }, "Error clearing jobs");
		process.exit(1);
	}
}

clearAllJobs();
