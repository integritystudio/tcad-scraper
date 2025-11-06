#!/usr/bin/env node
/**
 * Enqueue Trust & Estate Searches
 * Queues trust and estate-related search terms (high-yield searches)
 */

import { scraperQueue } from '../queues/scraper.queue';
import { logger } from '../lib/logger';
import { config } from '../config';

const TRUST_TERMS = [
  'Trust',
  'Trustee',
  'Estate',
  'Family Trust',
  'Revocable Trust',
  'Irrevocable Trust',
  'Living Trust',
  'Testamentary',
  'Fiduciary',
  'Beneficiary',
];

async function enqueueTrustBatch() {
  logger.info('📜 Starting Trust & Estate Batch Enqueue');
  logger.info(`Auto-refresh token enabled: ${config.scraper.autoRefreshToken}`);
  logger.info(`Expected high yield: ~70+ properties per term`);

  try {
    let successCount = 0;
    let failCount = 0;

    for (const term of TRUST_TERMS) {
      try {
        const job = await scraperQueue.add('scrape-properties', {
          searchTerm: term,
          userId: 'trust-batch-enqueue',
          scheduled: true,
        }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          priority: 1, // Highest priority - best yield
          removeOnComplete: 100,
          removeOnFail: 50,
        });

        successCount++;
        logger.info(`✅ [${successCount}/${TRUST_TERMS.length}] Queued: "${term}" (Job ID: ${job.id})`);
      } catch (error) {
        failCount++;
        logger.error(`❌ Failed to queue "${term}":`, error);
      }
    }

    logger.info(`\n📊 Summary: ${successCount} queued, ${failCount} failed`);
    logger.info(`📈 Estimated total properties: ${successCount * 70} (if all succeed)`);
    logger.info('✨ Trust batch enqueue completed!');
  } catch (error) {
    logger.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

enqueueTrustBatch()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error('❌ Script failed:', error);
    process.exit(1);
  });
