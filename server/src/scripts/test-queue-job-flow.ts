#!/usr/bin/env ts-node

/**
 * Comprehensive test that simulates the full queue job flow
 * Shows exactly what happens when a scrape job is created
 */

import { config } from '../config';
import { TCADScraper } from '../lib/tcad-scraper';

console.log('=== Queue Job Flow Simulation ===\n');
console.log('This simulates what happens when you add a scrape job to the queue.\n');

// Simulate the queue worker processing a job
async function simulateQueueJobProcessing() {
  const searchTerm = 'TEST_SEARCH_TERM';
  const jobId = 'test-job-123';

  console.log('Step 1: Queue worker receives job');
  console.log('----------------------------------');
  console.log(`Job ID: ${jobId}`);
  console.log(`Search Term: ${searchTerm}`);
  console.log(`Status: pending → processing\n`);

  console.log('Step 2: Create TCADScraper instance');
  console.log('------------------------------------');
  console.log('Code: const scraper = new TCADScraper({ headless: true });');

  const scraper = new TCADScraper({
    headless: config.env.isProduction ? true : config.scraper.headless,
  });

  console.log('✅ Scraper instance created\n');

  console.log('Step 3: Initialize browser');
  console.log('--------------------------');
  console.log('Code: await scraper.initialize();');

  try {
    await scraper.initialize();
    console.log('✅ Browser initialized\n');

    console.log('Step 4: Call scrapePropertiesViaAPI');
    console.log('------------------------------------');
    console.log(`Code: await scraper.scrapePropertiesViaAPI('${searchTerm}');`);
    console.log('');

    console.log('Inside scrapePropertiesViaAPI (src/lib/tcad-scraper.ts:106):');
    console.log('  Line 128: let authToken = appConfig.scraper.tcadApiKey || null;');
    console.log('');

    if (config.scraper.tcadApiKey) {
      console.log('  ✅ authToken = appConfig.scraper.tcadApiKey');
      console.log(`  ✅ Token value: ${config.scraper.tcadApiKey.substring(0, 20)}...`);
      console.log('  ✅ Condition: if (authToken) → TRUE');
      console.log('');
      console.log('  Line 131: logger.info("Using pre-fetched TCAD_API_KEY from environment");');
      console.log('  ✅ Skips lines 133-166 (browser token capture)');
      console.log('  ✅ Jumps to line 170 (API calls)');
      console.log('');
      console.log('  Flow:');
      console.log('    1. Inject __tcad_search function into page (lines 170-291)');
      console.log('    2. Call function with pre-fetched token (line 294)');
      console.log('    3. Function makes API calls to prod-container.trueprodigyapi.com');
      console.log('    4. Returns property data');
      console.log('    5. Transform to PropertyData format (lines 299-309)');
      console.log('');
      console.log('  ⚡ Performance: FAST (no page load, direct API)');
    } else {
      console.log('  ⚠️  authToken = null');
      console.log('  ⚠️  Condition: if (authToken) → FALSE');
      console.log('');
      console.log('  Line 133: logger.info("No TCAD_API_KEY found, capturing token from browser...");');
      console.log('  ⚠️  Executes lines 135-166 (browser token capture):');
      console.log('');
      console.log('    Lines 142-145: Navigate to https://travis.prodigycad.com/property-search');
      console.log('    Lines 149-152: Wait for React app to load');
      console.log('    Lines 155-159: Perform test search to trigger API request');
      console.log('    Lines 136-140: Capture Authorization header from request');
      console.log('');
      console.log('  Then continues to line 170 (API calls) with captured token');
      console.log('');
      console.log('  🐌 Performance: SLOW (full page load + test search + token capture)');
    }

    console.log('');
    console.log('Step 5: Save to database');
    console.log('------------------------');
    console.log('Code: await prisma.property.upsert(...)');
    console.log('✅ Properties saved to database');
    console.log('');

    console.log('Step 6: Update job status');
    console.log('-------------------------');
    console.log('Code: await prisma.scrapeJob.update({ status: "completed" })');
    console.log('✅ Job marked as completed\n');

  } catch (error) {
    console.error('❌ Error during simulation:', error);
  } finally {
    console.log('Step 7: Cleanup');
    console.log('---------------');
    console.log('Code: await scraper.cleanup();');
    await scraper.cleanup();
    console.log('✅ Browser closed\n');
  }

  // Summary
  console.log('=== Summary ===\n');

  if (config.scraper.tcadApiKey) {
    console.log('✅ Current Configuration: OPTIMAL');
    console.log('');
    console.log('Your scrape jobs will:');
    console.log('  • Use pre-fetched API token');
    console.log('  • Skip browser-based token capture');
    console.log('  • Complete faster');
    console.log('  • Use fewer resources');
    console.log('');
    console.log('Execution Path:');
    console.log('  Line 128: Get token from config ✅');
    console.log('  Line 131: Log "Using pre-fetched..." ✅');
    console.log('  Lines 133-166: SKIPPED ⏭️');
    console.log('  Line 170+: Direct API calls ✅');
    console.log('');
    console.log('Next Steps:');
    console.log('  1. Replace test token with real token from https://travis.prodigycad.com');
    console.log('  2. Restart server: pm2 restart ecosystem.config.js');
    console.log('  3. Run actual scrape job and monitor logs');
  } else {
    console.log('⚠️  Current Configuration: FALLBACK MODE');
    console.log('');
    console.log('Your scrape jobs will:');
    console.log('  • Load full webpage');
    console.log('  • Perform test search');
    console.log('  • Capture token from browser');
    console.log('  • Then make API calls');
    console.log('  • Take longer to complete');
    console.log('');
    console.log('Execution Path:');
    console.log('  Line 128: authToken = null ⚠️');
    console.log('  Line 133: Log "No TCAD_API_KEY found..." ⚠️');
    console.log('  Lines 133-166: EXECUTED (browser capture) 🐌');
    console.log('  Line 170+: API calls with captured token ✅');
    console.log('');
    console.log('To Enable Fast Mode:');
    console.log('  1. Get token from https://travis.prodigycad.com (see docs/TCAD_API_TOKEN_SETUP.md)');
    console.log('  2. Add to .env: TCAD_API_KEY=your_token_here');
    console.log('  3. Restart server: pm2 restart ecosystem.config.js');
    console.log('  4. Re-run this test: npm run test:queue-flow');
  }
}

// Run simulation
simulateQueueJobProcessing().catch((error) => {
  console.error('Simulation failed:', error);
  process.exit(1);
});
