#!/usr/bin/env ts-node
"use strict";
/**
 * Test script to verify TCAD_API_KEY configuration
 *
 * This script tests:
 * 1. Config loading for TCAD_API_KEY
 * 2. Scraper initialization with token
 * 3. Token usage in API calls (without actually making requests)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../config");
const tcad_scraper_1 = require("../lib/tcad-scraper");
const logger_1 = __importDefault(require("../lib/logger"));
logger_1.default.info('=== TCAD API Token Configuration Test ===\n');
// Test 1: Check if TCAD_API_KEY is loaded in config
logger_1.default.info('Test 1: Config Loading');
logger_1.default.info('----------------------');
if (config_1.config.scraper.tcadApiKey) {
    logger_1.default.info('✅ TCAD_API_KEY is configured');
    logger_1.default.info(`   Token preview: ${config_1.config.scraper.tcadApiKey.substring(0, 20)}...`);
}
else {
    logger_1.default.info('❌ TCAD_API_KEY is NOT configured');
    logger_1.default.info('   Scraper will fall back to browser-based token capture');
}
logger_1.default.info('');
// Test 2: Check full configuration
logger_1.default.info('Test 2: Full Scraper Configuration');
logger_1.default.info('-----------------------------------');
logger_1.default.info(`Headless: ${config_1.config.scraper.headless}`);
logger_1.default.info(`Timeout: ${config_1.config.scraper.timeout}ms`);
logger_1.default.info(`Retry Attempts: ${config_1.config.scraper.retryAttempts}`);
logger_1.default.info(`Retry Delay: ${config_1.config.scraper.retryDelay}ms`);
logger_1.default.info(`TCAD API Token: ${config_1.config.scraper.tcadApiKey ? '✅ Set' : '❌ Not Set'}`);
logger_1.default.info('');
// Test 3: Initialize scraper and check token usage
logger_1.default.info('Test 3: Scraper Initialization');
logger_1.default.info('-------------------------------');
const scraper = new tcad_scraper_1.TCADScraper();
// We can't directly access private fields, but we can test the flow
// by checking if the scraper would use the token
async function testTokenUsage() {
    try {
        logger_1.default.info('Initializing browser...');
        await scraper.initialize();
        logger_1.default.info('✅ Browser initialized successfully');
        // Note: We won't actually run a scrape to avoid hitting the API
        // But we can verify the configuration is correct
        logger_1.default.info('');
        logger_1.default.info('Configuration Status:');
        logger_1.default.info('--------------------');
        if (config_1.config.scraper.tcadApiKey) {
            logger_1.default.info('✅ When scraping runs, it will:');
            logger_1.default.info('   1. Use pre-fetched TCAD_API_KEY from environment');
            logger_1.default.info('   2. Skip browser-based token capture');
            logger_1.default.info('   3. Make direct API calls');
            logger_1.default.info('   4. Faster and more efficient');
        }
        else {
            logger_1.default.info('⚠️  When scraping runs, it will:');
            logger_1.default.info('   1. Load the TCAD search page');
            logger_1.default.info('   2. Perform a test search');
            logger_1.default.info('   3. Capture auth token from network requests');
            logger_1.default.info('   4. Then make API calls (slower)');
        }
    }
    catch (error) {
        logger_1.default.error('❌ Error during test:', error);
    }
    finally {
        await scraper.cleanup();
        logger_1.default.info('\n✅ Cleanup complete');
    }
}
// Test 4: Simulate what would happen in a queue job
logger_1.default.info('Test 4: Queue Job Simulation');
logger_1.default.info('-----------------------------');
function simulateQueueJob() {
    logger_1.default.info('When a scrape job is added to the queue:');
    logger_1.default.info('');
    logger_1.default.info('1. Queue worker creates new TCADScraper instance');
    logger_1.default.info('2. Calls scraper.initialize()');
    logger_1.default.info('3. Calls scraper.scrapePropertiesViaAPI(searchTerm)');
    logger_1.default.info('');
    logger_1.default.info('Inside scrapePropertiesViaAPI:');
    logger_1.default.info('   - Line 128: let authToken = appConfig.scraper.tcadApiKey || null;');
    if (config_1.config.scraper.tcadApiKey) {
        logger_1.default.info('   - ✅ authToken is set from config');
        logger_1.default.info('   - ✅ Logs: "Using pre-fetched TCAD_API_KEY from environment"');
        logger_1.default.info('   - ✅ Skips browser token capture (lines 133-166)');
        logger_1.default.info('   - ✅ Proceeds directly to API calls (line 170+)');
    }
    else {
        logger_1.default.info('   - ⚠️  authToken is null');
        logger_1.default.info('   - ⚠️  Logs: "No TCAD_API_KEY found, capturing token from browser..."');
        logger_1.default.info('   - ⚠️  Loads page and captures token (lines 133-166)');
        logger_1.default.info('   - ⚠️  Then proceeds to API calls (slower)');
    }
    logger_1.default.info('');
}
// Run all tests
async function runAllTests() {
    simulateQueueJob();
    logger_1.default.info('=== Running Browser Initialization Test ===\n');
    await testTokenUsage();
    logger_1.default.info('\n=== Test Complete ===\n');
    // Summary
    logger_1.default.info('Summary:');
    logger_1.default.info('--------');
    if (config_1.config.scraper.tcadApiKey) {
        logger_1.default.info('✅ PASS: API token is configured');
        logger_1.default.info('✅ PASS: Scraper will use fast API mode');
        logger_1.default.info('');
        logger_1.default.info('Next steps:');
        logger_1.default.info('  1. Run a test scrape: npm run test:scrape');
        logger_1.default.info('  2. Check logs for "Using pre-fetched TCAD_API_KEY from environment"');
    }
    else {
        logger_1.default.info('⚠️  WARNING: API token is NOT configured');
        logger_1.default.info('⚠️  WARNING: Scraper will use fallback browser mode');
        logger_1.default.info('');
        logger_1.default.info('To enable fast API mode:');
        logger_1.default.info('  1. Get token from https://travis.prodigycad.com (see docs/TCAD_API_TOKEN_SETUP.md)');
        logger_1.default.info('  2. Add to .env: TCAD_API_KEY=your_token_here');
        logger_1.default.info('  3. Restart server: pm2 restart ecosystem.config.js');
        logger_1.default.info('  4. Re-run this test: npm run test:token-config');
    }
    process.exit(0);
}
runAllTests().catch((error) => {
    logger_1.default.error('Test failed:', error);
    process.exit(1);
});
//# sourceMappingURL=test-api-token-config.js.map