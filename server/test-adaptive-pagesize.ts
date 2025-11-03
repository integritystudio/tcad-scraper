#!/usr/bin/env npx tsx

import { TCADScraper } from './src/lib/tcad-scraper';
import { logger } from './src/lib/logger';

async function testAdaptivePageSize() {
  console.log('🧪 Testing Adaptive Page Size Solution\n');
  console.log('='.repeat(60));

  // Test with terms that previously failed due to JSON truncation
  const testTerms = [
    'West 3rd',           // Previously failed
    'Grant Portfolio',    // Previously failed
    'Smith',              // Known to work (baseline)
  ];

  const scraper = new TCADScraper();
  await scraper.initialize();

  for (const term of testTerms) {
    console.log(`\n📋 Testing term: "${term}"`);
    console.log('-'.repeat(60));

    try {
      const results = await scraper.scrapeProperties(term);

      console.log(`✅ SUCCESS: Found ${results.length} properties`);

      if (results.length > 0) {
        console.log(`   Sample: ${results[0].name} - ${results[0].propertyAddress}`);
      }

    } catch (error: any) {
      console.log(`❌ FAILED: ${error.message}`);
    }
  }

  await scraper.close();
  console.log('\n' + '='.repeat(60));
  console.log('✨ Test complete\n');
}

testAdaptivePageSize()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
