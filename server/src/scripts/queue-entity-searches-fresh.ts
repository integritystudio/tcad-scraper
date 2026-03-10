import logger from "../lib/logger";
import { scraperQueue } from "../queues/scraper.queue";
import { getErrorMessage } from "../utils/error-helpers";

/**
 * Queue 50 high-yield entity term searches with fresh TCAD token
 * First clears failed jobs, then queues new searches
 */

const ENTITY_TERMS = [
	// Trust/Estate terms (highest yield)
	"Trust",
	"Estate",
	"Family",
	"Revocable",
	"Irrevocable",

	// Business entities - LLC variations
	"LLC.",
	"LLC",
	"L.L.C",
	"L.L.C.",
	"Limited",
	"Limit",
	"LMTD",

	// Business entities - Corporation
	"Corp",
	"Corp.",
	"Corporation",
	"Inc.",
	"Inc",
	"Incorporated",

	// Partnership terms
	"Part",
	"Partnership",
	"Partners",
	"Assoc",
	"Association",
	"Associates",

	// Property/Real Estate terms
	"Real",
	"Realty",
	"Properties",
	"Property",
	"Park",
	"Parc",
	"Plaza",
	"Center",

	// Management/Investment terms
	"Manage",
	"Management",
	"Investments",
	"Holdings",
	"Group",
	"Ventures",

	// Other entity terms
	"Home",
	"Homes",
	"Company",
	"Foundation",
	"Fund",
	"Capital",
	"Development",
	"Builders",
	"Construction",
];

async function clearAndQueueSearches() {
	logger.info("🔄 Clearing Failed Jobs and Queuing Fresh Entity Searches\n");
	logger.info(`${"=".repeat(80)}\n`);

	try {
		// Clean up failed jobs
		logger.info("🧹 Cleaning up failed jobs...");
		const failedJobs = await scraperQueue.getFailed(0, 100);
		logger.info(`Found ${failedJobs.length} failed jobs`);

		let removedCount = 0;
		for (const job of failedJobs) {
			try {
				await job.remove();
				removedCount++;
			} catch (error) {
				logger.error(
					`Failed to remove job ${job.id}: ${getErrorMessage(error)}`,
				);
			}
		}
		logger.info(`✅ Removed ${removedCount} failed jobs\n`);

		// Take first 50 entity terms
		const searchTerms = ENTITY_TERMS.slice(0, 50);

		logger.info(
			`Queuing ${searchTerms.length} high-yield entity term searches...\n`,
		);

		const jobs = [];
		let queuedCount = 0;
		let failedCount = 0;

		for (const searchTerm of searchTerms) {
			try {
				const job = await scraperQueue.add(
					"scrape-properties",
					{
						searchTerm,
						userId: "entity-batch-scraper-fresh",
						scheduled: true,
					},
					{
						attempts: 3,
						backoff: {
							type: "exponential",
							delay: 2000,
						},
						removeOnComplete: 100,
						removeOnFail: 50,
					},
				);

				jobs.push(job);
				queuedCount++;
				logger.info(
					`✅ [${queuedCount}/${searchTerms.length}] Queued: "${searchTerm}" (Job ID: ${job.id})`,
				);
			} catch (error) {
				failedCount++;
				logger.error(
					`❌ Failed to queue "${searchTerm}": ${getErrorMessage(error)}`,
				);
			}
		}

		logger.info(`\n${"─".repeat(80)}`);
		logger.info("QUEUE SUMMARY");
		logger.info(`${"─".repeat(80)}\n`);
		logger.info(`✅ Successfully queued: ${queuedCount} jobs`);
		logger.info(`❌ Failed to queue: ${failedCount} jobs`);
		logger.info(`📊 Total jobs added: ${queuedCount}`);

		if (queuedCount > 0) {
			logger.info(`\n${"=".repeat(80)}`);
			logger.info("MONITORING");
			logger.info(`${"=".repeat(80)}\n`);
			logger.info(
				"🎯 Bull Board Dashboard: http://localhost:3001/admin/queues",
			);
			logger.info(
				"   Monitor job progress, view completed/failed jobs, and queue stats\n",
			);

			logger.info("📈 Expected Results:");
			logger.info(`   - Entity terms average: ~70 properties/search`);
			logger.info(
				`   - Estimated total properties: ${queuedCount * 70} (if all succeed)`,
			);
			logger.info(
				`   - Processing time: ~${Math.ceil(((queuedCount / 2) * 15) / 60)} hours (2 concurrent workers)\n`,
			);

			logger.info("⚠️  Note: Token expires in 5 minutes!");
			logger.info(
				"   token-refresh.service.ts handles auto-refresh via Cloudflare Worker\n",
			);
		}

		logger.info("✨ Entity term searches queued successfully!\n");
	} catch (error) {
		logger.error(`❌ Fatal error: ${getErrorMessage(error)}`);
		process.exit(1);
	}
}

// Run the script
clearAndQueueSearches()
	.then(() => {
		logger.info("✅ Script completed. Jobs are now processing...");
		process.exit(0);
	})
	.catch((error) => {
		logger.error("❌ Script failed:", error);
		process.exit(1);
	});
