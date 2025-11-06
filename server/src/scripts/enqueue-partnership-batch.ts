#!/usr/bin/env node
/**
 * Enqueue Partnership Property Searches
 * Queues partnership and association search terms
 */

import { scraperQueue } from '../queues/scraper.queue';
import { logger } from '../lib/logger';
import { config } from '../config';

const PARTNERSHIP_TERMS = [
  'Partnership',
  'Partners',
  'Part',
  'LP',
  'LLP',
  'Association',
  'Associates',
  'Assoc',
  'Assoc.',
  'Joint Venture',
];

async function enqueuePartnershipBatch() {
  logger.info('🤝 Starting Partnership Batch Enqueue');
  logger.info(`Auto-refresh token enabled: ${config.scraper.autoRefreshToken}`);

  try {
    let successCount = 0;
    let failCount = 0;

    for (const term of PARTNERSHIP_TERMS) {
      try {
        const job = await scraperQueue.add('scrape-properties', {
          searchTerm: term,
          userId: 'partnership-batch-enqueue',
          scheduled: true,
        }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          priority: 3,
          removeOnComplete: 100,
          removeOnFail: 50,
        });

        successCount++;
        logger.info(`✅ [${successCount}/${PARTNERSHIP_TERMS.length}] Queued: "${term}" (Job ID: ${job.id})`);
      } catch (error) {
        failCount++;
        logger.error(`❌ Failed to queue "${term}":`, error);
      }
    }

    logger.info(`\n📊 Summary: ${successCount} queued, ${failCount} failed`);
    logger.info('✨ Partnership batch enqueue completed!');
  } catch (error) {
    logger.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

enqueuePartnershipBatch()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error('❌ Script failed:', error);
    process.exit(1);
  });
