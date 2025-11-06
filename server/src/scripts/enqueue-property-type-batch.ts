#!/usr/bin/env node
/**
 * Enqueue Property Type Searches
 * Queues property type and real estate search terms
 */

import { scraperQueue } from '../queues/scraper.queue';
import { logger } from '../lib/logger';
import { config } from '../config';

const PROPERTY_TYPE_TERMS = [
  'Properties',
  'Property',
  'Real Estate',
  'Realty',
  'Land',
  'Acres',
  'Development',
  'Developers',
  'Plaza',
  'Center',
];

async function enqueuePropertyTypeBatch() {
  logger.info('🏘️  Starting Property Type Batch Enqueue');
  logger.info(`Auto-refresh token enabled: ${config.scraper.autoRefreshToken}`);

  try {
    let successCount = 0;
    let failCount = 0;

    for (const term of PROPERTY_TYPE_TERMS) {
      try {
        const job = await scraperQueue.add('scrape-properties', {
          searchTerm: term,
          userId: 'property-type-batch-enqueue',
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
        logger.info(`✅ [${successCount}/${PROPERTY_TYPE_TERMS.length}] Queued: "${term}" (Job ID: ${job.id})`);
      } catch (error) {
        failCount++;
        logger.error(`❌ Failed to queue "${term}":`, error);
      }
    }

    logger.info(`\n📊 Summary: ${successCount} queued, ${failCount} failed`);
    logger.info('✨ Property type batch enqueue completed!');
  } catch (error) {
    logger.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

enqueuePropertyTypeBatch()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error('❌ Script failed:', error);
    process.exit(1);
  });
