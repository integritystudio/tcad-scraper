#!/usr/bin/env node
/**
 * Enqueue Residential Property Searches
 * Queues common residential property search terms
 */

import { scraperQueue } from '../queues/scraper.queue';
import logger from '../lib/logger';
import { config } from '../config';

const RESIDENTIAL_TERMS = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Miller',
  'Davis',
  'Garcia',
  'Rodriguez',
  'Wilson',
];

async function enqueueResidentialBatch() {
  logger.info('🏠 Starting Residential Batch Enqueue');
  logger.info(`Auto-refresh token enabled: ${config.scraper.autoRefreshToken}`);
  logger.info(`Token refresh interval: ${config.scraper.tokenRefreshInterval}ms`);

  try {
    let successCount = 0;
    let failCount = 0;

    for (const term of RESIDENTIAL_TERMS) {
      try {
        const job = await scraperQueue.add('scrape-properties', {
          searchTerm: term,
          userId: 'residential-batch-enqueue',
          scheduled: true,
        }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: 50,
        });

        successCount++;
        logger.info(`✅ [${successCount}/${RESIDENTIAL_TERMS.length}] Queued: "${term}" (Job ID: ${job.id})`);
      } catch (error) {
        failCount++;
        logger.error({ err: error }, `❌ Failed to queue "${term}":`);
      }
    }

    logger.info(`\n📊 Summary: ${successCount} queued, ${failCount} failed`);
    logger.info('✨ Residential batch enqueue completed!');
  } catch (error) {
    logger.error({ err: error }, '❌ Fatal error:');
    process.exit(1);
  }
}

enqueueResidentialBatch()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error({ err: error }, '❌ Script failed:');
    process.exit(1);
  });
