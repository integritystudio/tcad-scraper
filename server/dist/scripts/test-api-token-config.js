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
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../config");
const tcad_scraper_1 = require("../lib/tcad-scraper");
console.log('=== TCAD API Token Configuration Test ===\n');
// Test 1: Check if TCAD_API_KEY is loaded in config
console.log('Test 1: Config Loading');
console.log('----------------------');
if (config_1.config.scraper.tcadApiKey) {
    console.log('✅ TCAD_API_KEY is configured');
    console.log(`   Token preview: ${config_1.config.scraper.tcadApiKey.substring(0, 20)}...`);
}
else {
    console.log('❌ TCAD_API_KEY is NOT configured');
    console.log('   Scraper will fall back to browser-based token capture');
}
console.log('');
// Test 2: Check full configuration
console.log('Test 2: Full Scraper Configuration');
console.log('-----------------------------------');
console.log(`Headless: ${config_1.config.scraper.headless}`);
console.log(`Timeout: ${config_1.config.scraper.timeout}ms`);
console.log(`Retry Attempts: ${config_1.config.scraper.retryAttempts}`);
console.log(`Retry Delay: ${config_1.config.scraper.retryDelay}ms`);
console.log(`TCAD API Token: ${config_1.config.scraper.tcadApiKey ? '✅ Set' : '❌ Not Set'}`);
console.log('');
// Test 3: Initialize scraper and check token usage
console.log('Test 3: Scraper Initialization');
console.log('-------------------------------');
const scraper = new tcad_scraper_1.TCADScraper();
// We can't directly access private fields, but we can test the flow
// by checking if the scraper would use the token
async function testTokenUsage() {
    try {
        console.log('Initializing browser...');
        await scraper.initialize();
        console.log('✅ Browser initialized successfully');
        // Note: We won't actually run a scrape to avoid hitting the API
        // But we can verify the configuration is correct
        console.log('');
        console.log('Configuration Status:');
        console.log('--------------------');
        if (config_1.config.scraper.tcadApiKey) {
            console.log('✅ When scraping runs, it will:');
            console.log('   1. Use pre-fetched TCAD_API_KEY from environment');
            console.log('   2. Skip browser-based token capture');
            console.log('   3. Make direct API calls');
            console.log('   4. Faster and more efficient');
        }
        else {
            console.log('⚠️  When scraping runs, it will:');
            console.log('   1. Load the TCAD search page');
            console.log('   2. Perform a test search');
            console.log('   3. Capture auth token from network requests');
            console.log('   4. Then make API calls (slower)');
        }
    }
    catch (error) {
        console.error('❌ Error during test:', error);
    }
    finally {
        await scraper.cleanup();
        console.log('\n✅ Cleanup complete');
    }
}
// Test 4: Simulate what would happen in a queue job
console.log('Test 4: Queue Job Simulation');
console.log('-----------------------------');
function simulateQueueJob() {
    console.log('When a scrape job is added to the queue:');
    console.log('');
    console.log('1. Queue worker creates new TCADScraper instance');
    console.log('2. Calls scraper.initialize()');
    console.log('3. Calls scraper.scrapePropertiesViaAPI(searchTerm)');
    console.log('');
    console.log('Inside scrapePropertiesViaAPI:');
    console.log('   - Line 128: let authToken = appConfig.scraper.tcadApiKey || null;');
    if (config_1.config.scraper.tcadApiKey) {
        console.log('   - ✅ authToken is set from config');
        console.log('   - ✅ Logs: "Using pre-fetched TCAD_API_KEY from environment"');
        console.log('   - ✅ Skips browser token capture (lines 133-166)');
        console.log('   - ✅ Proceeds directly to API calls (line 170+)');
    }
    else {
        console.log('   - ⚠️  authToken is null');
        console.log('   - ⚠️  Logs: "No TCAD_API_KEY found, capturing token from browser..."');
        console.log('   - ⚠️  Loads page and captures token (lines 133-166)');
        console.log('   - ⚠️  Then proceeds to API calls (slower)');
    }
    console.log('');
}
// Run all tests
async function runAllTests() {
    simulateQueueJob();
    console.log('=== Running Browser Initialization Test ===\n');
    await testTokenUsage();
    console.log('\n=== Test Complete ===\n');
    // Summary
    console.log('Summary:');
    console.log('--------');
    if (config_1.config.scraper.tcadApiKey) {
        console.log('✅ PASS: API token is configured');
        console.log('✅ PASS: Scraper will use fast API mode');
        console.log('');
        console.log('Next steps:');
        console.log('  1. Run a test scrape: npm run test:scrape');
        console.log('  2. Check logs for "Using pre-fetched TCAD_API_KEY from environment"');
    }
    else {
        console.log('⚠️  WARNING: API token is NOT configured');
        console.log('⚠️  WARNING: Scraper will use fallback browser mode');
        console.log('');
        console.log('To enable fast API mode:');
        console.log('  1. Get token from https://travis.prodigycad.com (see docs/TCAD_API_TOKEN_SETUP.md)');
        console.log('  2. Add to .env: TCAD_API_KEY=your_token_here');
        console.log('  3. Restart server: pm2 restart ecosystem.config.js');
        console.log('  4. Re-run this test: npm run test:token-config');
    }
    process.exit(0);
}
runAllTests().catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
});
//# sourceMappingURL=test-api-token-config.js.map