#!/usr/bin/env node
/**
 * Enqueue Foundation & Nonprofit Searches
 * Queues foundation, nonprofit, and charitable organization search terms
 */

import { scraperQueue } from '../queues/scraper.queue';
import logger from '../lib/logger';
import { config } from '../config';

const FOUNDATION_TERMS = [
  'Foundation',
  'Charitable',
  'Charity',
  'Nonprofit',
  'Non-Profit',
  'Organization',
  'Institute',
  'Society',
  'Association',
  'Endowment',
];

async function enqueueFoundationBatch() {
  logger.info('🎗️  Starting Foundation Batch Enqueue');
  logger.info(`Auto-refresh token enabled: ${config.scraper.autoRefreshToken}`);

  try {
    let successCount = 0;
    let failCount = 0;

    for (const term of FOUNDATION_TERMS) {
      try {
        const job = await scraperQueue.add('scrape-properties', {
          searchTerm: term,
          userId: 'foundation-batch-enqueue',
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
        logger.info(`✅ [${successCount}/${FOUNDATION_TERMS.length}] Queued: "${term}" (Job ID: ${job.id})`);
      } catch (error) {
        failCount++;
        logger.error({ err: error }, `❌ Failed to queue "${term}":`);
      }
    }

    logger.info(`\n📊 Summary: ${successCount} queued, ${failCount} failed`);
    logger.info('✨ Foundation batch enqueue completed!');
  } catch (error) {
    logger.error({ err: error }, '❌ Fatal error:');
    process.exit(1);
  }
}

enqueueFoundationBatch()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error({ err: error }, '❌ Script failed:');
    process.exit(1);
  });
