import logger from "../lib/logger";
import { scraperQueue } from "../queues/scraper.queue";

const PRIORITY_TERMS = [
	"Lake",
	"River",
	"Pecan",
	"Maple",
	"Oak",
	"Mount",
	"Limited",
];

async function enqueuePriorityTerms() {
	logger.info("Enqueueing priority search terms...");

	for (const term of PRIORITY_TERMS) {
		try {
			await scraperQueue.add(
				"scrape",
				{ searchTerm: term },
				{ priority: 1 }, // Higher priority (lower number = higher priority in Bull)
			);
			logger.info(`✓ Enqueued: ${term}`);
		} catch (error) {
			logger.error({ error, term }, `✗ Failed to enqueue ${term}`);
		}
	}

	logger.info(
		`\n✓ Successfully enqueued ${PRIORITY_TERMS.length} priority terms`,
	);
	logger.info("These jobs will be processed before other waiting jobs");
	process.exit(0);
}

enqueuePriorityTerms().catch((err) => {
	logger.error({ err }, "Error");
	process.exit(1);
});
