import logger from "../lib/logger";
import { scraperQueue } from "../queues/scraper.queue";
import { enqueueBatch } from "./lib/queue-utils";
import { getErrorMessage } from "../utils/error-helpers";

/**
 * Queue high-yield entity term searches.
 *
 * Usage:
 *   tsx queue-entity-searches.ts           # queue only
 *   tsx queue-entity-searches.ts --fresh   # clear failed jobs first, then queue
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

async function queueEntitySearches(fresh: boolean) {
	const label = fresh
		? "Clearing Failed Jobs and Queuing Fresh Entity Searches"
		: "Queuing Entity Term Searches for TCAD Scraper";
	logger.info(`🔄 ${label}\n`);
	logger.info(`${"=".repeat(80)}\n`);

	if (fresh) {
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
	}

	const searchTerms = ENTITY_TERMS.slice(0, 50);
	const userId = fresh ? "entity-batch-scraper-fresh" : "entity-batch-scraper";
	logger.info(`Queuing ${searchTerms.length} high-yield entity term searches...\n`);

	const queuedCount = await enqueueBatch(searchTerms, userId, logger);
	const failedCount = searchTerms.length - queuedCount;

	logger.info(`\n${"─".repeat(80)}`);
	logger.info("QUEUE SUMMARY");
	logger.info(`${"─".repeat(80)}\n`);
	logger.info(`✅ Successfully queued: ${queuedCount} jobs`);
	logger.info(`❌ Failed to queue: ${failedCount} jobs`);

	if (queuedCount > 0) {
		logger.info(`\n${"=".repeat(80)}`);
		logger.info("MONITORING");
		logger.info(`${"=".repeat(80)}\n`);
		logger.info("🎯 Bull Board Dashboard: http://localhost:3001/admin/queues");
		logger.info(
			"   Monitor job progress, view completed/failed jobs, and queue stats\n",
		);
		logger.info("📈 Expected Results:");
		logger.info("   - Entity terms average: ~70 properties/search");
		logger.info(
			`   - Estimated total properties: ${queuedCount * 70} (if all succeed)`,
		);
		logger.info(
			`   - Processing time: ~${Math.ceil(((queuedCount / 2) * 15) / 60)} hours (2 concurrent workers)\n`,
		);
		if (fresh) {
			logger.info("⚠️  Note: Token expires in 5 minutes!");
			logger.info(
				"   token-refresh.service.ts handles auto-refresh via Cloudflare Worker\n",
			);
		}
	}

	logger.info("✨ Entity term searches queued successfully!\n");
}

if (require.main === module) {
	const fresh = process.argv.includes("--fresh");
	queueEntitySearches(fresh)
		.then(() => {
			logger.info("✅ Script completed. Jobs are now processing...");
			process.exit(0);
		})
		.catch((error: unknown) => {
			logger.error(`❌ Fatal error: ${getErrorMessage(error)}`);
			process.exit(1);
		});
}
