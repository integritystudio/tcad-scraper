import { TCADScraper } from '../lib/tcad-scraper';

async function testFix() {
  console.log('🧪 Testing fixed scraper...\n');

  const scraper = new TCADScraper();

  try {
    await scraper.initialize();

    const searchTerm = 'dede';
    console.log(`Searching for: "${searchTerm}"`);

    const properties = await scraper.scrapeProperties(searchTerm, 1);

    console.log(`\n✅ Found ${properties.length} properties!\n`);

    if (properties.length > 0) {
      console.log('Sample property:');
      console.log(JSON.stringify(properties[0], null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await scraper.cleanup();
  }
}

testFix();
