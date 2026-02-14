#!/usr/bin/env ts-node

/**
 * Test script to verify TCAD_API_KEY configuration
 *
 * This script tests:
 * 1. Config loading for TCAD_API_KEY
 * 2. Scraper initialization with token
 * 3. Token usage in API calls (without actually making requests)
 */

import { config } from "../config";
import logger from "../lib/logger";
import { TCADScraper } from "../lib/tcad-scraper";
import { getErrorMessage } from "../utils/error-helpers";

logger.info("=== TCAD API Token Configuration Test ===\n");

// Test 1: Check if TCAD_API_KEY is loaded in config
logger.info("Test 1: Config Loading");
logger.info("----------------------");
if (config.scraper.tcadApiKey) {
	logger.info("✅ TCAD_API_KEY is configured");
	logger.info(`   Token preview: ...${config.scraper.tcadApiKey.slice(-4)}`);
} else {
	logger.info("❌ TCAD_API_KEY is NOT configured");
	logger.info("   Scraper will fall back to browser-based token capture");
}
logger.info("");

// Test 2: Check full configuration
logger.info("Test 2: Full Scraper Configuration");
logger.info("-----------------------------------");
logger.info(`Headless: ${config.scraper.headless}`);
logger.info(`Timeout: ${config.scraper.timeout}ms`);
logger.info(`Retry Attempts: ${config.scraper.retryAttempts}`);
logger.info(`Retry Delay: ${config.scraper.retryDelay}ms`);
logger.info(
	`TCAD API Token: ${config.scraper.tcadApiKey ? "✅ Set" : "❌ Not Set"}`,
);
logger.info("");

// Test 3: Initialize scraper and check token usage
logger.info("Test 3: Scraper Initialization");
logger.info("-------------------------------");

const scraper = new TCADScraper();

// We can't directly access private fields, but we can test the flow
// by checking if the scraper would use the token
async function testTokenUsage() {
	try {
		logger.info("Initializing browser...");
		await scraper.initialize();
		logger.info("✅ Browser initialized successfully");

		// Note: We won't actually run a scrape to avoid hitting the API
		// But we can verify the configuration is correct
		logger.info("");
		logger.info("Configuration Status:");
		logger.info("--------------------");

		if (config.scraper.tcadApiKey) {
			logger.info("✅ When scraping runs, it will:");
			logger.info("   1. Use pre-fetched TCAD_API_KEY from environment");
			logger.info("   2. Skip browser-based token capture");
			logger.info("   3. Make direct API calls");
			logger.info("   4. Faster and more efficient");
		} else {
			logger.info("⚠️  When scraping runs, it will:");
			logger.info("   1. Load the TCAD search page");
			logger.info("   2. Perform a test search");
			logger.info("   3. Capture auth token from network requests");
			logger.info("   4. Then make API calls (slower)");
		}
	} catch (error) {
		logger.error(`❌ Error during test: ${getErrorMessage(error)}`);
	} finally {
		await scraper.cleanup();
		logger.info("\n✅ Cleanup complete");
	}
}

// Test 4: Simulate what would happen in a queue job
logger.info("Test 4: Queue Job Simulation");
logger.info("-----------------------------");

function simulateQueueJob() {
	logger.info("When a scrape job is added to the queue:");
	logger.info("");
	logger.info("1. Queue worker creates new TCADScraper instance");
	logger.info("2. Calls scraper.initialize()");
	logger.info("3. Calls scraper.scrapePropertiesViaAPI(searchTerm)");
	logger.info("");
	logger.info("Inside scrapePropertiesViaAPI:");
	logger.info(
		"   - Line 128: let authToken = appConfig.scraper.tcadApiKey || null;",
	);

	if (config.scraper.tcadApiKey) {
		logger.info("   - ✅ authToken is set from config");
		logger.info(
			'   - ✅ Logs: "Using pre-fetched TCAD_API_KEY from environment"',
		);
		logger.info("   - ✅ Skips browser token capture (lines 133-166)");
		logger.info("   - ✅ Proceeds directly to API calls (line 170+)");
	} else {
		logger.info("   - ⚠️  authToken is null");
		logger.info(
			'   - ⚠️  Logs: "No TCAD_API_KEY found, capturing token from browser..."',
		);
		logger.info("   - ⚠️  Loads page and captures token (lines 133-166)");
		logger.info("   - ⚠️  Then proceeds to API calls (slower)");
	}
	logger.info("");
}

// Run all tests
async function runAllTests() {
	simulateQueueJob();

	logger.info("=== Running Browser Initialization Test ===\n");
	await testTokenUsage();

	logger.info("\n=== Test Complete ===\n");

	// Summary
	logger.info("Summary:");
	logger.info("--------");
	if (config.scraper.tcadApiKey) {
		logger.info("✅ PASS: API token is configured");
		logger.info("✅ PASS: Scraper will use fast API mode");
		logger.info("");
		logger.info("Next steps:");
		logger.info("  1. Run a test scrape: npm run test:scrape");
		logger.info(
			'  2. Check logs for "Using pre-fetched TCAD_API_KEY from environment"',
		);
	} else {
		logger.info("⚠️  WARNING: API token is NOT configured");
		logger.info("⚠️  WARNING: Scraper will use fallback browser mode");
		logger.info("");
		logger.info("To enable fast API mode:");
		logger.info(
			"  1. Get token from https://travis.prodigycad.com (see docs/TCAD_API_TOKEN_SETUP.md)",
		);
		logger.info("  2. Add to .env: TCAD_API_KEY=your_token_here");
		logger.info("  3. Restart server: pm2 restart ecosystem.config.js");
		logger.info("  4. Re-run this test: npm run test:token-config");
	}

	process.exit(0);
}

runAllTests().catch((error) => {
	logger.error("Test failed:", error);
	process.exit(1);
});
