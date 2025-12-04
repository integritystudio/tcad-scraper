import logger from "../lib/logger";
import { scraperQueue } from "../queues/scraper.queue";

async function enqueueGrove() {
	logger.info("Enqueueing job for search term: Grove");
	await scraperQueue.add("scrape", { searchTerm: "Grove" });
	logger.info("Job enqueued successfully");
	process.exit(0);
}

enqueueGrove().catch((err) => {
	logger.error("Error enqueueing job:", err);
	process.exit(1);
});
