#!/usr/bin/env node
/**
 * Enqueue Corporation Property Searches
 * Queues corporation-related search terms
 */

import { scraperQueue } from '../queues/scraper.queue';
import logger from '../lib/logger';
import { config } from '../config';

const CORPORATION_TERMS = [
  'Corp',
  'Corp.',
  'Corporation',
  'Incorporated',
  'Inc',
  'Inc.',
  'Company',
  'Co.',
  'Enterprise',
  'Enterprises',
];

async function enqueueCorporationBatch() {
  logger.info('🏛️  Starting Corporation Batch Enqueue');
  logger.info(`Auto-refresh token enabled: ${config.scraper.autoRefreshToken}`);

  try {
    let successCount = 0;
    let failCount = 0;

    for (const term of CORPORATION_TERMS) {
      try {
        const job = await scraperQueue.add('scrape-properties', {
          searchTerm: term,
          userId: 'corporation-batch-enqueue',
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
        logger.info(`✅ [${successCount}/${CORPORATION_TERMS.length}] Queued: "${term}" (Job ID: ${job.id})`);
      } catch (error) {
        failCount++;
        logger.error({ err: error }, `❌ Failed to queue "${term}":`);
      }
    }

    logger.info(`\n📊 Summary: ${successCount} queued, ${failCount} failed`);
    logger.info('✨ Corporation batch enqueue completed!');
  } catch (error) {
    logger.error({ err: error }, '❌ Fatal error:');
    process.exit(1);
  }
}

enqueueCorporationBatch()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error({ err: error }, '❌ Script failed:');
    process.exit(1);
  });
