#!/usr/bin/env node
/**
 * Enqueue Commercial Property Searches
 * Queues commercial property-related search terms
 */

import { scraperQueue } from '../queues/scraper.queue';
import logger from '../lib/logger';
import { config } from '../config';

const COMMERCIAL_TERMS = [
  'Shopping',
  'Retail',
  'Office',
  'Warehouse',
  'Industrial',
  'Commercial',
  'Business',
  'Store',
  'Mall',
  'Building',
];

async function enqueueCommercialBatch() {
  logger.info('🏢 Starting Commercial Batch Enqueue');
  logger.info(`Auto-refresh token enabled: ${config.scraper.autoRefreshToken}`);
  logger.info(`Using Doppler: ${config.doppler.enabled ? 'Yes' : 'No'}`);

  try {
    let successCount = 0;
    let failCount = 0;

    for (const term of COMMERCIAL_TERMS) {
      try {
        const job = await scraperQueue.add('scrape-properties', {
          searchTerm: term,
          userId: 'commercial-batch-enqueue',
          scheduled: true,
        }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          priority: 2, // Higher priority for commercial
          removeOnComplete: 100,
          removeOnFail: 50,
        });

        successCount++;
        logger.info(`✅ [${successCount}/${COMMERCIAL_TERMS.length}] Queued: "${term}" (Job ID: ${job.id})`);
      } catch (error) {
        failCount++;
        logger.error({ err: error }, `❌ Failed to queue "${term}":`);
      }
    }

    logger.info(`\n📊 Summary: ${successCount} queued, ${failCount} failed`);
    logger.info('✨ Commercial batch enqueue completed!');
  } catch (error) {
    logger.error({ err: error }, '❌ Fatal error:');
    process.exit(1);
  }
}

enqueueCommercialBatch()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error({ err: error }, '❌ Script failed:');
    process.exit(1);
  });
