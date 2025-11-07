#!/usr/bin/env node
/**
 * Enqueue High-Value Batch Searches (40 queries)
 *
 * This script:
 * 1. Refreshes the TCAD API token first
 * 2. Enqueues 40 high-value search terms across multiple categories
 *
 * Categories included:
 * - Trust & Estate (highest yield ~70+ properties)
 * - Investment & Holdings (high yield)
 * - Corporate entities (LLC, Corp, etc.)
 * - Commercial properties
 * - Property types
 */

import { scraperQueue } from '../queues/scraper.queue';
import logger from '../lib/logger';
import { config } from '../config';
import { tokenRefreshService } from '../services/token-refresh.service';

// 40 High-Value Search Terms
const HIGH_VALUE_TERMS = [
  // Trust & Estate (10 terms - ~70+ properties each)
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

  // Investment & Holdings (10 terms - high yield)
  'Investments',
  'Holdings',
  'Capital',
  'Fund',
  'Equity',
  'Ventures',
  'Asset',
  'Portfolio',
  'Management',
  'Partners',

  // Corporate Entities (10 terms - high volume)
  'LLC',
  'Limited',
  'Corporation',
  'Corp',
  'Inc',
  'Partnership',
  'LP',
  'LLP',
  'Company',
  'Group',

  // Commercial & Property Types (10 terms)
  'Commercial',
  'Residential',
  'Industrial',
  'Office',
  'Retail',
  'Warehouse',
  'Shopping',
  'Apartment',
  'Condo',
  'Development',
];

async function enqueueHighValueBatch() {
  logger.info('💎 Starting High-Value Batch Enqueue (40 queries)');
  logger.info(`Auto-refresh token enabled: ${config.scraper.autoRefreshToken}`);

  try {
    // Step 1: Refresh token first
    logger.info('🔄 Step 1/2: Refreshing TCAD API token...');
    const startRefresh = Date.now();

    const token = await tokenRefreshService.refreshToken();
    const refreshDuration = Date.now() - startRefresh;

    if (token) {
      logger.info(`✅ Token refreshed successfully in ${refreshDuration}ms`);
      logger.info(`   Token preview: ${token.substring(0, 30)}...`);
    } else {
      logger.warn('⚠️  Token refresh returned null - continuing with existing token');
    }

    // Step 2: Enqueue all queries
    logger.info('\n📋 Step 2/2: Enqueueing high-value queries...');
    logger.info(`Total queries to enqueue: ${HIGH_VALUE_TERMS.length}`);

    let successCount = 0;
    let failCount = 0;
    const startEnqueue = Date.now();

    for (let i = 0; i < HIGH_VALUE_TERMS.length; i++) {
      const term = HIGH_VALUE_TERMS[i];

      try {
        // Determine priority based on category
        let priority = 3; // Default
        if (i < 10) {
          priority = 1; // Trust & Estate - highest priority
        } else if (i < 20) {
          priority = 1; // Investment - high priority
        } else if (i < 30) {
          priority = 2; // Corporate - medium-high priority
        }

        const job = await scraperQueue.add('scrape-properties', {
          searchTerm: term,
          userId: 'high-value-batch-enqueue',
          scheduled: true,
        }, {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          priority,
          removeOnComplete: 100,
          removeOnFail: 50,
        });

        successCount++;

        // Determine category for logging
        let category = '';
        if (i < 10) category = 'Trust/Estate';
        else if (i < 20) category = 'Investment';
        else if (i < 30) category = 'Corporate';
        else category = 'Commercial';

        logger.info(
          `✅ [${successCount}/${HIGH_VALUE_TERMS.length}] ` +
          `Queued: "${term}" (${category}, Priority: ${priority}, Job ID: ${job.id})`
        );

        // Small delay to avoid overwhelming the queue
        if (i < HIGH_VALUE_TERMS.length - 1) {
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
    logger.info('📊 BATCH ENQUEUE SUMMARY');
    logger.info('='.repeat(60));
    logger.info(`✅ Successfully queued: ${successCount}/${HIGH_VALUE_TERMS.length}`);
    logger.info(`❌ Failed: ${failCount}`);
    logger.info(`⏱️  Enqueue duration: ${enqueueDuration}ms`);
    logger.info(`⏱️  Total duration (with token refresh): ${refreshDuration + enqueueDuration}ms`);

    if (successCount > 0) {
      logger.info(`\n📈 Estimated minimum properties: ${successCount * 50}`);
      logger.info(`📈 Estimated maximum properties: ${successCount * 100}`);
      logger.info(`   (Trust/Estate terms typically yield 70-100+ each)`);
    }

    logger.info('\n✨ High-value batch enqueue completed!');
    logger.info('Monitor progress at: http://localhost:3001/admin/queues');
    logger.info('='.repeat(60));

  } catch (error) {
    logger.error({ err: error }, '❌ Fatal error');
    process.exit(1);
  }
}

// Run the script
enqueueHighValueBatch()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error({ err: error }, '❌ Script failed');
    process.exit(1);
  });
