import logger from "../lib/logger";
import { getErrorMessage } from "../utils/error-helpers";
import { TCADScraper } from "../lib/tcad-scraper";

async function testApiDiscovery() {
	logger.info("Starting API discovery...");

	const scraper = new TCADScraper({
		headless: false, // Run with visible browser to see what's happening
	});

	try {
		await scraper.initialize();

		// Use the discoverApiEndpoint method via type assertion
		// @ts-expect-error - accessing private method for testing
		await scraper.discoverApiEndpoint("Willow");

		logger.info("\n✅ API discovery complete!");
	} catch (error) {
		logger.error(
			`❌ API discovery failed: ${getErrorMessage(error)}`,
		);
	} finally {
		await scraper.cleanup();
	}
}

testApiDiscovery();
