#!/usr/bin/env npx tsx

import { TCADScraper } from './src/lib/tcad-scraper';
import { prisma } from './src/lib/prisma';

async function debugTrustSearch() {
  console.log('\n🔍 Debugging "Trust" Search Term\n');
  console.log('=' .repeat(60));

  const scraper = new TCADScraper();
  const searchTerm = 'Trust';

  try {
    console.log(`\n📋 Testing search term: "${searchTerm}"`);
    console.log(`⏰ Start time: ${new Date().toLocaleTimeString()}\n`);

    console.log('🚀 Initializing scraper...');
    await scraper.initialize();
    console.log('✅ Scraper initialized\n');

    // Add detailed logging by monkey-patching fetch
    const originalFetch = global.fetch;
    let requestCount = 0;
    let totalResponseSize = 0;

    (global as any).fetch = async (...args: any[]) => {
      requestCount++;
      console.log(`  📤 Request #${requestCount}: ${args[0]}`);

      const response = await originalFetch(...args);

      // Clone response to read body size
      const clonedResponse = response.clone();
      try {
        const text = await clonedResponse.text();
        const size = text.length;
        totalResponseSize += size;
        console.log(`  📥 Response #${requestCount}: ${response.status} ${response.statusText}`);
        console.log(`     Size: ${size.toLocaleString()} characters (${(size / 1024).toFixed(2)} KB)`);
        console.log(`     Content-Type: ${response.headers.get('content-type')}`);

        // Check if response looks truncated
        if (!text.endsWith('}') && !text.endsWith(']')) {
          console.log(`     ⚠️  Response may be truncated! Last 50 chars: "${text.slice(-50)}"`);
        }
      } catch (e) {
        console.log(`  ❌ Error reading response body for logging: ${e}`);
      }

      return response;
    };

    const results = await scraper.scrapePropertiesViaAPI(searchTerm);

    // Restore original fetch
    global.fetch = originalFetch;

    console.log(`\n✅ Search completed successfully!`);
    console.log(`📊 Results:`);
    console.log(`   - Properties found: ${results.length}`);
    console.log(`   - Total requests made: ${requestCount}`);
    console.log(`   - Total response size: ${totalResponseSize.toLocaleString()} characters (${(totalResponseSize / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`   - Average per request: ${(totalResponseSize / requestCount).toLocaleString()} characters`);

    if (results.length > 0) {
      console.log(`\n📝 Sample properties (first 5):`);
      results.slice(0, 5).forEach((prop, idx) => {
        console.log(`   ${idx + 1}. ${prop.ownerName} - ${prop.siteAddress || 'No address'}`);
      });
    }

  } catch (error: any) {
    console.log(`\n❌ Search FAILED with error:\n`);
    console.log(`Error type: ${error.constructor.name}`);
    console.log(`Error message: ${error.message}`);

    if (error.stack) {
      console.log(`\nStack trace:`);
      console.log(error.stack);
    }

    // Try to get more details about the error
    if (error.message.includes('JSON')) {
      console.log(`\n🔍 JSON Parse Error Details:`);
      console.log(`   This indicates the API response could not be parsed as valid JSON.`);
      console.log(`   Possible causes:`);
      console.log(`   1. Response too large and got truncated by server/network`);
      console.log(`   2. Response contains invalid characters`);
      console.log(`   3. Server timeout mid-response`);
      console.log(`   4. Content-Type mismatch (HTML error page instead of JSON)`);
    }

    if (error.message.includes('timeout') || error.name === 'AbortError') {
      console.log(`\n⏱️  Timeout Error:`);
      console.log(`   The request took too long (>60 seconds).`);
      console.log(`   This suggests the result set is extremely large.`);
    }
  }

  console.log('\n' + '=' .repeat(60));
  console.log(`⏰ End time: ${new Date().toLocaleTimeString()}\n`);

  await scraper.cleanup();
  await prisma.$disconnect();
}

debugTrustSearch().then(() => process.exit(0)).catch((e) => {
  console.error('❌ Debug script error:', e);
  process.exit(1);
});
