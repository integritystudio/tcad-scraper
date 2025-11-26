import { scraperQueue } from '../queues/scraper.queue';
import logger from '../lib/logger';

// Ultra-high-value terms based on complete database analysis
// These are PROVEN patterns that haven't been tried yet
const ULTRA_HIGH_PRIORITY = [
  // Street terms (expected 5,000-10,000 each based on Avenue/Court performance)
  'Street',     // Expected: 10,000+ (like Avenue)
  'Drive',      // Expected: 5,000+
  'Lane',       // Expected: 5,000+
  'Road',       // Expected: 5,000+

  // Female names (expected 1,500-3,000 each)
  'Amy',        // Top 50 US name - Expected: 2,000+
  'Cynthia',    // Top 50 US name - Expected: 1,500+

  // Geographic terms (expected 2,000-4,000 each based on River/Rock)
  'Brook',      // Expected: 3,000+
  'Meadow',     // Expected: 2,500+
  'Valley',     // Expected: 3,000+
  'Point',      // Expected: 2,000+
];

async function enqueueUltraHighPriority() {
  logger.info('🚀 Enqueueing ULTRA-high-priority terms...\n');
  logger.info('Expected yield: 40,000-60,000 properties from these 10 terms!\n');

  for (const term of ULTRA_HIGH_PRIORITY) {
    try {
      await scraperQueue.add(
        'scrape-properties',
        { searchTerm: term },
        { priority: -100 }  // Ultra-high priority
      );
      logger.info(`✓ Enqueued: ${term}`);
    } catch (error) {
      logger.error({ error, term }, `✗ Failed to enqueue ${term}`);
    }
  }

  logger.info(`\n✅ Successfully enqueued ${ULTRA_HIGH_PRIORITY.length} ultra-high-priority terms`);
  process.exit(0);
}

enqueueUltraHighPriority().catch((err) => {
  logger.error({ err }, 'Error');
  process.exit(1);
});
