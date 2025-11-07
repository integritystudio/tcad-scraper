#!/usr/bin/env node
/**
 * Enqueue Test Batch (20 queries)
 * Tests the fixed token refresh with high-value search terms
 */

import { scraperQueue } from '../queues/scraper.queue';
import logger from '../lib/logger';
import { config } from '../config';

// 20 High-Value Search Terms (including repeats from previous batch)
const TEST_TERMS = [
  // Trust & Estate terms (repeat some from before)
  'Trust',
  'Family Trust',
  'Estate',
  'Living Trust',
  'Trustee',

  // Real estate related
  'Real Estate',
  'Real',
  'Family',
  'Property',
  'Land',

  // Investment terms
  'Investment',
  'Holdings',
  'Capital',
  'Partners',
  'Fund',

  // Entity types
  'LLC',
  'Limited',
  'Partnership',
  'Corporation',
  'Company',
];

async function enqueueTestBatch() {
  logger.info('🧪 Starting Test Batch Enqueue (20 queries with fixed token refresh)');
  logger.info(`Auto-refresh token enabled: ${config.scraper.autoRefreshToken}`);

  try {
    let successCount = 0;
    let failCount = 0;
    const startEnqueue = Date.now();
    const jobIds: number[] = [];

    for (let i = 0; i < TEST_TERMS.length; i++) {
      const term = TEST_TERMS[i];

      try {
        const job = await scraperQueue.add('scrape-properties', {
          searchTerm: term,
          userId: 'test-batch-20',
          scheduled: true,
        }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          priority: 1, // High priority
          removeOnComplete: 100,
          removeOnFail: 50,
        });

        successCount++;
        jobIds.push(Number(job.id));

        logger.info(
          `✅ [${successCount}/${TEST_TERMS.length}] ` +
          `Queued: "${term}" (Job ID: ${job.id})`
        );

        // Small delay to avoid overwhelming the queue
        if (i < TEST_TERMS.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        failCount++;
        logger.error({ err: error }, `❌ Failed to queue "${term}"`);
      }
    }

    const enqueueDuration = Date.now() - startEnqueue;

    // Summary
    logger.info('\n' + '='.repeat(60));
    logger.info('📊 TEST BATCH ENQUEUE SUMMARY');
    logger.info('='.repeat(60));
    logger.info(`✅ Successfully queued: ${successCount}/${TEST_TERMS.length}`);
    logger.info(`❌ Failed: ${failCount}`);
    logger.info(`⏱️  Enqueue duration: ${enqueueDuration}ms`);
    logger.info(`📋 Job IDs: ${jobIds.join(', ')}`);
    logger.info('\n✨ Test batch enqueue completed!');
    logger.info('Monitor progress at: http://hobbes.taildb60fa.ts.net:3001/admin/queues');
    logger.info('='.repeat(60));

  } catch (error) {
    logger.error({ err: error }, '❌ Fatal error');
    process.exit(1);
  }
}

// Run the script
enqueueTestBatch()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error({ err: error }, '❌ Script failed');
    process.exit(1);
  });
