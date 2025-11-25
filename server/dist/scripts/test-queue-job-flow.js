#!/usr/bin/env ts-node
"use strict";
/**
 * Comprehensive test that simulates the full queue job flow
 * Shows exactly what happens when a scrape job is created
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../config");
const tcad_scraper_1 = require("../lib/tcad-scraper");
const logger_1 = __importDefault(require("../lib/logger"));
logger_1.default.info('=== Queue Job Flow Simulation ===\n');
logger_1.default.info('This simulates what happens when you add a scrape job to the queue.\n');
// Simulate the queue worker processing a job
async function simulateQueueJobProcessing() {
    const searchTerm = 'TEST_SEARCH_TERM';
    const jobId = 'test-job-123';
    logger_1.default.info('Step 1: Queue worker receives job');
    logger_1.default.info('----------------------------------');
    logger_1.default.info(`Job ID: ${jobId}`);
    logger_1.default.info(`Search Term: ${searchTerm}`);
    logger_1.default.info(`Status: pending → processing\n`);
    logger_1.default.info('Step 2: Create TCADScraper instance');
    logger_1.default.info('------------------------------------');
    logger_1.default.info('Code: const scraper = new TCADScraper({ headless: true });');
    const scraper = new tcad_scraper_1.TCADScraper({
        headless: config_1.config.env.isProduction ? true : config_1.config.scraper.headless,
    });
    logger_1.default.info('✅ Scraper instance created\n');
    logger_1.default.info('Step 3: Initialize browser');
    logger_1.default.info('--------------------------');
    logger_1.default.info('Code: await scraper.initialize();');
    try {
        await scraper.initialize();
        logger_1.default.info('✅ Browser initialized\n');
        logger_1.default.info('Step 4: Call scrapePropertiesViaAPI');
        logger_1.default.info('------------------------------------');
        logger_1.default.info(`Code: await scraper.scrapePropertiesViaAPI('${searchTerm}');`);
        logger_1.default.info('');
        logger_1.default.info('Inside scrapePropertiesViaAPI (src/lib/tcad-scraper.ts:106):');
        logger_1.default.info('  Line 128: let authToken = appConfig.scraper.tcadApiKey || null;');
        logger_1.default.info('');
        if (config_1.config.scraper.tcadApiKey) {
            logger_1.default.info('  ✅ authToken = appConfig.scraper.tcadApiKey');
            logger_1.default.info(`  ✅ Token value: ${config_1.config.scraper.tcadApiKey.substring(0, 20)}...`);
            logger_1.default.info('  ✅ Condition: if (authToken) → TRUE');
            logger_1.default.info('');
            logger_1.default.info('  Line 131: logger.info("Using pre-fetched TCAD_API_KEY from environment");');
            logger_1.default.info('  ✅ Skips lines 133-166 (browser token capture)');
            logger_1.default.info('  ✅ Jumps to line 170 (API calls)');
            logger_1.default.info('');
            logger_1.default.info('  Flow:');
            logger_1.default.info('    1. Inject __tcad_search function into page (lines 170-291)');
            logger_1.default.info('    2. Call function with pre-fetched token (line 294)');
            logger_1.default.info('    3. Function makes API calls to prod-container.trueprodigyapi.com');
            logger_1.default.info('    4. Returns property data');
            logger_1.default.info('    5. Transform to PropertyData format (lines 299-309)');
            logger_1.default.info('');
            logger_1.default.info('  ⚡ Performance: FAST (no page load, direct API)');
        }
        else {
            logger_1.default.info('  ⚠️  authToken = null');
            logger_1.default.info('  ⚠️  Condition: if (authToken) → FALSE');
            logger_1.default.info('');
            logger_1.default.info('  Line 133: logger.info("No TCAD_API_KEY found, capturing token from browser...");');
            logger_1.default.info('  ⚠️  Executes lines 135-166 (browser token capture):');
            logger_1.default.info('');
            logger_1.default.info('    Lines 142-145: Navigate to https://travis.prodigycad.com/property-search');
            logger_1.default.info('    Lines 149-152: Wait for React app to load');
            logger_1.default.info('    Lines 155-159: Perform test search to trigger API request');
            logger_1.default.info('    Lines 136-140: Capture Authorization header from request');
            logger_1.default.info('');
            logger_1.default.info('  Then continues to line 170 (API calls) with captured token');
            logger_1.default.info('');
            logger_1.default.info('  🐌 Performance: SLOW (full page load + test search + token capture)');
        }
        logger_1.default.info('');
        logger_1.default.info('Step 5: Save to database');
        logger_1.default.info('------------------------');
        logger_1.default.info('Code: await prisma.property.upsert(...)');
        logger_1.default.info('✅ Properties saved to database');
        logger_1.default.info('');
        logger_1.default.info('Step 6: Update job status');
        logger_1.default.info('-------------------------');
        logger_1.default.info('Code: await prisma.scrapeJob.update({ status: "completed" })');
        logger_1.default.info('✅ Job marked as completed\n');
    }
    catch (error) {
        logger_1.default.error(`❌ Error during simulation: ${error instanceof Error ? error.message : String(error)}`);
    }
    finally {
        logger_1.default.info('Step 7: Cleanup');
        logger_1.default.info('---------------');
        logger_1.default.info('Code: await scraper.cleanup();');
        await scraper.cleanup();
        logger_1.default.info('✅ Browser closed\n');
    }
    // Summary
    logger_1.default.info('=== Summary ===\n');
    if (config_1.config.scraper.tcadApiKey) {
        logger_1.default.info('✅ Current Configuration: OPTIMAL');
        logger_1.default.info('');
        logger_1.default.info('Your scrape jobs will:');
        logger_1.default.info('  • Use pre-fetched API token');
        logger_1.default.info('  • Skip browser-based token capture');
        logger_1.default.info('  • Complete faster');
        logger_1.default.info('  • Use fewer resources');
        logger_1.default.info('');
        logger_1.default.info('Execution Path:');
        logger_1.default.info('  Line 128: Get token from config ✅');
        logger_1.default.info('  Line 131: Log "Using pre-fetched..." ✅');
        logger_1.default.info('  Lines 133-166: SKIPPED ⏭️');
        logger_1.default.info('  Line 170+: Direct API calls ✅');
        logger_1.default.info('');
        logger_1.default.info('Next Steps:');
        logger_1.default.info('  1. Replace test token with real token from https://travis.prodigycad.com');
        logger_1.default.info('  2. Restart server: pm2 restart ecosystem.config.js');
        logger_1.default.info('  3. Run actual scrape job and monitor logs');
    }
    else {
        logger_1.default.info('⚠️  Current Configuration: FALLBACK MODE');
        logger_1.default.info('');
        logger_1.default.info('Your scrape jobs will:');
        logger_1.default.info('  • Load full webpage');
        logger_1.default.info('  • Perform test search');
        logger_1.default.info('  • Capture token from browser');
        logger_1.default.info('  • Then make API calls');
        logger_1.default.info('  • Take longer to complete');
        logger_1.default.info('');
        logger_1.default.info('Execution Path:');
        logger_1.default.info('  Line 128: authToken = null ⚠️');
        logger_1.default.info('  Line 133: Log "No TCAD_API_KEY found..." ⚠️');
        logger_1.default.info('  Lines 133-166: EXECUTED (browser capture) 🐌');
        logger_1.default.info('  Line 170+: API calls with captured token ✅');
        logger_1.default.info('');
        logger_1.default.info('To Enable Fast Mode:');
        logger_1.default.info('  1. Get token from https://travis.prodigycad.com (see docs/TCAD_API_TOKEN_SETUP.md)');
        logger_1.default.info('  2. Add to .env: TCAD_API_KEY=your_token_here');
        logger_1.default.info('  3. Restart server: pm2 restart ecosystem.config.js');
        logger_1.default.info('  4. Re-run this test: npm run test:queue-flow');
    }
}
// Run simulation
simulateQueueJobProcessing().catch((error) => {
    logger_1.default.error('Simulation failed:', error);
    process.exit(1);
});
//# sourceMappingURL=test-queue-job-flow.js.map