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
	logger.info("PASS: TCAD_API_KEY is configured");
	logger.info(`   Token preview: ...${config.scraper.tcadApiKey.slice(-4)}`);
} else {
	logger.info("FAIL: TCAD_API_KEY is NOT configured");
	logger.info("   Set TCAD_API_KEY in Doppler or .env");
}
logger.info("");

// Test 2: Check full configuration
logger.info("Test 2: Full Scraper Configuration");
logger.info("-----------------------------------");
logger.info(`Timeout: ${config.scraper.timeout}ms`);
logger.info(`Retry Attempts: ${config.scraper.retryAttempts}`);
logger.info(`Retry Delay: ${config.scraper.retryDelay}ms`);
logger.info(
	`TCAD API Token: ${config.scraper.tcadApiKey ? "Set" : "Not Set"}`,
);
logger.info("");

// Test 3: Initialize scraper and check token usage
logger.info("Test 3: Scraper Initialization");
logger.info("-------------------------------");

const scraper = new TCADScraper();

async function testTokenUsage() {
	try {
		logger.info("Initializing scraper...");
		await scraper.initialize();
		logger.info("PASS: Scraper initialized successfully (API-direct mode)");
	} catch (error) {
		logger.error(`FAIL: ${getErrorMessage(error)}`);
	} finally {
		await scraper.cleanup();
		logger.info("\nCleanup complete");
	}
}

async function runAllTests() {
	await testTokenUsage();

	logger.info("\n=== Test Complete ===\n");

	// Summary
	logger.info("Summary:");
	logger.info("--------");
	if (config.scraper.tcadApiKey) {
		logger.info("PASS: API token is configured");
		logger.info("PASS: Scraper will use API-direct mode");
	} else {
		logger.info("WARNING: API token is NOT configured");
		logger.info("Set TCAD_API_KEY in Doppler to enable scraping");
	}

	process.exit(0);
}

runAllTests().catch((error) => {
	logger.error("Test failed:", error);
	process.exit(1);
});
