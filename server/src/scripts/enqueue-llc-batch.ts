#!/usr/bin/env node
/**
 * Enqueue LLC Property Searches
 * Queues LLC and limited company search terms
 */

import { scraperQueue } from '../queues/scraper.queue';
import { logger } from '../lib/logger';
import { config } from '../config';

const LLC_TERMS = [
  'LLC',
  'LLC.',
  'L.L.C.',
  'Limited Liability',
  'Limited',
  'LMTD',
  'Limit',
  'L L C',
  'LTD',
  'Co LLC',
];

async function enqueueLLCBatch() {
  logger.info('🏭 Starting LLC Batch Enqueue');
  logger.info(`Auto-refresh token enabled: ${config.scraper.autoRefreshToken}`);

  try {
    let successCount = 0;
    let failCount = 0;

    for (const term of LLC_TERMS) {
      try {
        const job = await scraperQueue.add('scrape-properties', {
          searchTerm: term,
          userId: 'llc-batch-enqueue',
          scheduled: true,
        }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          priority: 2,
          removeOnComplete: 100,
          removeOnFail: 50,
        });

        successCount++;
        logger.info(`✅ [${successCount}/${LLC_TERMS.length}] Queued: "${term}" (Job ID: ${job.id})`);
      } catch (error) {
        failCount++;
        logger.error(`❌ Failed to queue "${term}":`, error);
      }
    }

    logger.info(`\n📊 Summary: ${successCount} queued, ${failCount} failed`);
    logger.info('✨ LLC batch enqueue completed!');
  } catch (error) {
    logger.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

enqueueLLCBatch()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error('❌ Script failed:', error);
    process.exit(1);
  });
