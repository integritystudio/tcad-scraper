import { TCADScraper } from './lib/tcad-scraper';
import logger from './lib/logger';

async function testApiDiscovery() {
  logger.info('Starting API discovery...');

  const scraper = new TCADScraper({
    headless: false, // Run with visible browser to see what's happening
  });

  try {
    await scraper.initialize();

    // Use the discoverApiEndpoint method via type assertion
    // @ts-ignore - accessing private method for testing
    await scraper.discoverApiEndpoint('Willow');

    logger.info('\n✅ API discovery complete!');
  } catch (error) {
    logger.error(`❌ API discovery failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await scraper.cleanup();
  }
}

testApiDiscovery();
