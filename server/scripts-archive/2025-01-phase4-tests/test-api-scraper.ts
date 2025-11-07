import { TCADScraper } from '../lib/tcad-scraper';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()],
});

/**
 * Test the new API-based scraper with sample search terms
 */
async function testAPIScraper() {
  console.log('🧪 Testing New API-Based Scraper\n');
  console.log('=' .repeat(80) + '\n');

  const searchTerms = [
    'Smith',         // Common name - should have many results
    'Austin',        // City name - should have many results
    '1234 Lamar',    // Street address
    'Johnson LLC',   // Business name
    'Hyde Park',     // Neighborhood
  ];

  const scraper = new TCADScraper({ headless: true });

  try {
    await scraper.initialize();
    console.log('✅ Scraper initialized\n');

    const results: Array<{
      searchTerm: string;
      count: number;
      duration: number;
      sample: any;
    }> = [];

    for (const searchTerm of searchTerms) {
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`Testing search term: "${searchTerm}"`);
      console.log('─'.repeat(80));

      const startTime = Date.now();

      try {
        const properties = await scraper.scrapePropertiesViaAPI(searchTerm);
        const duration = Date.now() - startTime;

        console.log(`✅ Found ${properties.length} properties in ${(duration / 1000).toFixed(2)}s`);

        if (properties.length > 0) {
          const sample = properties[0];
          console.log('\nSample property:');
          console.log(`  Name: ${sample.name}`);
          console.log(`  Address: ${sample.propertyAddress}, ${sample.city || 'N/A'}`);
          console.log(`  Property ID: ${sample.propertyId}`);
          console.log(`  Appraised Value: $${sample.appraisedValue.toLocaleString()}`);
          console.log(`  Property Type: ${sample.propType}`);

          results.push({
            searchTerm,
            count: properties.length,
            duration,
            sample,
          });
        } else {
          console.log('  No properties found');
          results.push({
            searchTerm,
            count: 0,
            duration,
            sample: null,
          });
        }
      } catch (error) {
        console.error(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        results.push({
          searchTerm,
          count: -1, // Indicate error
          duration: Date.now() - startTime,
          sample: null,
        });
      }

      // Small delay between searches
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80) + '\n');

    console.log('Search Term          | Results | Time (s) | Status');
    console.log('-'.repeat(60));

    results.forEach(r => {
      const term = r.searchTerm.padEnd(20);
      const count = r.count === -1 ? 'ERROR'.padEnd(7) : r.count.toString().padEnd(7);
      const time = (r.duration / 1000).toFixed(2).padEnd(8);
      const status = r.count === -1 ? '❌' : r.count > 0 ? '✅' : '⚠️';
      console.log(`${term} | ${count} | ${time} | ${status}`);
    });

    const totalResults = results.reduce((sum, r) => sum + (r.count > 0 ? r.count : 0), 0);
    const avgTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    const successCount = results.filter(r => r.count >= 0).length;

    console.log('\n' + '─'.repeat(60));
    console.log(`Total properties found: ${totalResults.toLocaleString()}`);
    console.log(`Average time per search: ${(avgTime / 1000).toFixed(2)}s`);
    console.log(`Success rate: ${successCount}/${results.length} (${((successCount/results.length)*100).toFixed(1)}%)`);

    // Compare with old method
    console.log('\n' + '='.repeat(80));
    console.log('COMPARISON WITH OLD METHOD');
    console.log('='.repeat(80) + '\n');

    const oldMethodResults = results.length * 20; // Old method: max 20 results per search
    const improvement = totalResults / oldMethodResults;

    console.log(`Old method (DOM scraping):  ~${oldMethodResults} properties (20 per search)`);
    console.log(`New method (API scraping):  ${totalResults} properties`);
    console.log(`Improvement:                ${improvement.toFixed(1)}x more results`);
    console.log(`\n✅ API scraping method is ${improvement.toFixed(1)}x more effective!\n`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await scraper.cleanup();
    console.log('Scraper cleaned up');
  }
}

testAPIScraper();
