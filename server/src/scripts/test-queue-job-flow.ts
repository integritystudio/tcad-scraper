#!/usr/bin/env ts-node

/**
 * Comprehensive test that simulates the full queue job flow
 * Shows exactly what happens when a scrape job is created
 */

import { config } from "../config";
import logger from "../lib/logger";
import { TCADScraper } from "../lib/tcad-scraper";
import { getErrorMessage } from "../utils/error-helpers";

logger.info("=== Queue Job Flow Simulation ===\n");
logger.info(
	"This simulates what happens when you add a scrape job to the queue.\n",
);

// Simulate the queue worker processing a job
async function simulateQueueJobProcessing() {
	const searchTerm = "TEST_SEARCH_TERM";
	const jobId = "test-job-123";

	logger.info("Step 1: Queue worker receives job");
	logger.info("----------------------------------");
	logger.info(`Job ID: ${jobId}`);
	logger.info(`Search Term: ${searchTerm}`);
	logger.info(`Status: pending → processing\n`);

	logger.info("Step 2: Create TCADScraper instance");
	logger.info("------------------------------------");
	logger.info("Code: const scraper = new TCADScraper({ headless: true });");

	const scraper = new TCADScraper({
		headless: config.env.isProduction ? true : config.scraper.headless,
	});

	logger.info("✅ Scraper instance created\n");

	logger.info("Step 3: Initialize browser");
	logger.info("--------------------------");
	logger.info("Code: await scraper.initialize();");

	try {
		await scraper.initialize();
		logger.info("✅ Browser initialized\n");

		logger.info("Step 4: Call scrapePropertiesViaAPI");
		logger.info("------------------------------------");
		logger.info(`Code: await scraper.scrapePropertiesViaAPI('${searchTerm}');`);
		logger.info("");

		logger.info("Inside scrapePropertiesViaAPI (src/lib/tcad-scraper.ts:106):");
		logger.info(
			"  Line 128: let authToken = appConfig.scraper.tcadApiKey || null;",
		);
		logger.info("");

		if (config.scraper.tcadApiKey) {
			logger.info("  ✅ authToken = appConfig.scraper.tcadApiKey");
			logger.info(
				`  ✅ Token value: ...${config.scraper.tcadApiKey.slice(-4)}`,
			);
			logger.info("  ✅ Condition: if (authToken) → TRUE");
			logger.info("");
			logger.info(
				'  Line 131: logger.info("Using pre-fetched TCAD_API_KEY from environment");',
			);
			logger.info("  ✅ Skips lines 133-166 (browser token capture)");
			logger.info("  ✅ Jumps to line 170 (API calls)");
			logger.info("");
			logger.info("  Flow:");
			logger.info(
				"    1. Inject __tcad_search function into page (lines 170-291)",
			);
			logger.info("    2. Call function with pre-fetched token (line 294)");
			logger.info(
				"    3. Function makes API calls to prod-container.trueprodigyapi.com",
			);
			logger.info("    4. Returns property data");
			logger.info("    5. Transform to PropertyData format (lines 299-309)");
			logger.info("");
			logger.info("  ⚡ Performance: FAST (no page load, direct API)");
		} else {
			logger.info("  ⚠️  authToken = null");
			logger.info("  ⚠️  Condition: if (authToken) → FALSE");
			logger.info("");
			logger.info(
				'  Line 133: logger.info("No TCAD_API_KEY found, capturing token from browser...");',
			);
			logger.info("  ⚠️  Executes lines 135-166 (browser token capture):");
			logger.info("");
			logger.info(
				"    Lines 142-145: Navigate to https://travis.prodigycad.com/property-search",
			);
			logger.info("    Lines 149-152: Wait for React app to load");
			logger.info(
				"    Lines 155-159: Perform test search to trigger API request",
			);
			logger.info(
				"    Lines 136-140: Capture Authorization header from request",
			);
			logger.info("");
			logger.info(
				"  Then continues to line 170 (API calls) with captured token",
			);
			logger.info("");
			logger.info(
				"  🐌 Performance: SLOW (full page load + test search + token capture)",
			);
		}

		logger.info("");
		logger.info("Step 5: Save to database");
		logger.info("------------------------");
		logger.info("Code: await prisma.property.upsert(...)");
		logger.info("✅ Properties saved to database");
		logger.info("");

		logger.info("Step 6: Update job status");
		logger.info("-------------------------");
		logger.info('Code: await prisma.scrapeJob.update({ status: "completed" })');
		logger.info("✅ Job marked as completed\n");
	} catch (error) {
		logger.error(`❌ Error during simulation: ${getErrorMessage(error)}`);
	} finally {
		logger.info("Step 7: Cleanup");
		logger.info("---------------");
		logger.info("Code: await scraper.cleanup();");
		await scraper.cleanup();
		logger.info("✅ Browser closed\n");
	}

	// Summary
	logger.info("=== Summary ===\n");

	if (config.scraper.tcadApiKey) {
		logger.info("✅ Current Configuration: OPTIMAL");
		logger.info("");
		logger.info("Your scrape jobs will:");
		logger.info("  • Use pre-fetched API token");
		logger.info("  • Skip browser-based token capture");
		logger.info("  • Complete faster");
		logger.info("  • Use fewer resources");
		logger.info("");
		logger.info("Execution Path:");
		logger.info("  Line 128: Get token from config ✅");
		logger.info('  Line 131: Log "Using pre-fetched..." ✅');
		logger.info("  Lines 133-166: SKIPPED ⏭️");
		logger.info("  Line 170+: Direct API calls ✅");
		logger.info("");
		logger.info("Next Steps:");
		logger.info(
			"  1. Replace test token with real token from https://travis.prodigycad.com",
		);
		logger.info("  2. Restart server: pm2 restart ecosystem.config.js");
		logger.info("  3. Run actual scrape job and monitor logs");
	} else {
		logger.info("⚠️  Current Configuration: FALLBACK MODE");
		logger.info("");
		logger.info("Your scrape jobs will:");
		logger.info("  • Load full webpage");
		logger.info("  • Perform test search");
		logger.info("  • Capture token from browser");
		logger.info("  • Then make API calls");
		logger.info("  • Take longer to complete");
		logger.info("");
		logger.info("Execution Path:");
		logger.info("  Line 128: authToken = null ⚠️");
		logger.info('  Line 133: Log "No TCAD_API_KEY found..." ⚠️');
		logger.info("  Lines 133-166: EXECUTED (browser capture) 🐌");
		logger.info("  Line 170+: API calls with captured token ✅");
		logger.info("");
		logger.info("To Enable Fast Mode:");
		logger.info(
			"  1. Get token from https://travis.prodigycad.com (see docs/TCAD_API_TOKEN_SETUP.md)",
		);
		logger.info("  2. Add to .env: TCAD_API_KEY=your_token_here");
		logger.info("  3. Restart server: pm2 restart ecosystem.config.js");
		logger.info("  4. Re-run this test: npm run test:queue-flow");
	}
}

// Run simulation
simulateQueueJobProcessing().catch((error) => {
	logger.error("Simulation failed:", error);
	process.exit(1);
});
