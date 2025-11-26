import { scraperQueue } from '../queues/scraper.queue';
import logger from '../lib/logger';

// High-value terms identified from last hour analysis
const HIGH_PRIORITY_TERMS = [
  'Boulevard',  // Expected: 7,000+ (Avenue = 25,483)
  'Drive',      // Expected: 5,000+
  'Lane',       // Expected: 5,000+
  'Way',        // Expected: 3,000+
  'Terrace',    // Expected: 2,000+
  'Michelle',   // Expected: 2,000+ (top 30 US name)
];

async function enqueueHighPriority() {
  logger.info('Enqueueing high-priority search terms from analysis...\n');

  for (const term of HIGH_PRIORITY_TERMS) {
    try {
      await scraperQueue.add(
        'scrape-properties',
        { searchTerm: term },
        { priority: 1 } // Highest priority
      );
      logger.info(`✓ Enqueued: ${term}`);
    } catch (error) {
      logger.error({ error, term }, `✗ Failed to enqueue ${term}`);
    }
  }

  logger.info(`\n✓ Successfully enqueued ${HIGH_PRIORITY_TERMS.length} high-priority terms`);
  logger.info('Expected total: 24,000+ properties from these 6 terms alone!');
  process.exit(0);
}

enqueueHighPriority().catch((err) => {
  logger.error({ err }, 'Error');
  process.exit(1);
});
