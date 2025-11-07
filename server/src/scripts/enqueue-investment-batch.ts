#!/usr/bin/env node
/**
 * Enqueue Investment Property Searches
 * Queues investment and management search terms
 */

import { scraperQueue } from '../queues/scraper.queue';
import logger from '../lib/logger';
import { config } from '../config';

const INVESTMENT_TERMS = [
  'Investments',
  'Holdings',
  'Capital',
  'Fund',
  'Equity',
  'Ventures',
  'Asset',
  'Portfolio',
  'Management',
  'Manage',
];

async function enqueueInvestmentBatch() {
  logger.info('💰 Starting Investment Batch Enqueue');
  logger.info(`Auto-refresh token enabled: ${config.scraper.autoRefreshToken}`);

  try {
    let successCount = 0;
    let failCount = 0;

    for (const term of INVESTMENT_TERMS) {
      try {
        const job = await scraperQueue.add('scrape-properties', {
          searchTerm: term,
          userId: 'investment-batch-enqueue',
          scheduled: true,
        }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          priority: 1, // High priority - likely high yield
          removeOnComplete: 100,
          removeOnFail: 50,
        });

        successCount++;
        logger.info(`✅ [${successCount}/${INVESTMENT_TERMS.length}] Queued: "${term}" (Job ID: ${job.id})`);
      } catch (error) {
        failCount++;
        logger.error({ err: error }, `❌ Failed to queue "${term}":`);
      }
    }

    logger.info(`\n📊 Summary: ${successCount} queued, ${failCount} failed`);
    logger.info('✨ Investment batch enqueue completed!');
  } catch (error) {
    logger.error({ err: error }, '❌ Fatal error:');
    process.exit(1);
  }
}

enqueueInvestmentBatch()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error({ err: error }, '❌ Script failed:');
    process.exit(1);
  });
