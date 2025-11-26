import { scraperQueue } from '../queues/scraper.queue';
import logger from '../lib/logger';

const PRIORITY_TERMS = ['Lake', 'River', 'Pecan', 'Maple', 'Oak', 'Mount', 'Limited'];

async function enqueuePriorityTerms() {
  logger.info('Enqueueing priority search terms...');

  for (const term of PRIORITY_TERMS) {
    try {
      await scraperQueue.add(
        'scrape',
        { searchTerm: term },
        { priority: 1 } // Higher priority (lower number = higher priority in Bull)
      );
      logger.info(`✓ Enqueued: ${term}`);
    } catch (error) {
      logger.error(`✗ Failed to enqueue ${term}:`, error);
    }
  }

  logger.info(`\n✓ Successfully enqueued ${PRIORITY_TERMS.length} priority terms`);
  logger.info('These jobs will be processed before other waiting jobs');
  process.exit(0);
}

enqueuePriorityTerms().catch((err) => {
  logger.error('Error:', err);
  process.exit(1);
});
