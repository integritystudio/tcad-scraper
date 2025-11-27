#!/usr/bin/env npx tsx
/**
 * Re-queue Jobs That Failed Due to search_term_analytics Error
 *
 * This script re-queues the 365 unique search terms that failed
 * because of the missing search_term_analytics table error.
 *
 * Now that the fix is in place (error handling + regenerated Prisma client),
 * these jobs should process successfully.
 */

import { scraperQueue } from '../queues/scraper.queue';
import { prisma } from '../lib/prisma';
import logger from '../lib/logger';

const BATCH_SIZE = 50;

async function main() {
  logger.info('🔄 Re-queue Analytics-Failed Jobs');
  logger.info('='.repeat(60));

  try {
    // Get all unique search terms that failed due to search_term_analytics error
    logger.info('\n📋 Step 1: Querying jobs that failed due to search_term_analytics error...');

    const failedJobs = await prisma.scrapeJob.findMany({
      where: {
        status: 'failed',
        error: {
          contains: 'search_term_analytics'
        }
      },
      select: { searchTerm: true },
      distinct: ['searchTerm'],
      orderBy: { searchTerm: 'asc' }
    });

    const termsToRequeue = failedJobs.map(job => job.searchTerm);

    logger.info(`   Found ${termsToRequeue.length} unique search terms with analytics errors`);
    logger.info(`   Total jobs affected: 608 (from error report)`);

    if (termsToRequeue.length === 0) {
      logger.info('\n✅ No jobs to re-queue!');
      await cleanup();
      return;
    }

    // Show first 10 examples
    logger.info('\n   Examples:');
    termsToRequeue.slice(0, 10).forEach(term => {
      logger.info(`     - ${term}`);
    });
    if (termsToRequeue.length > 10) {
      logger.info(`     ... and ${termsToRequeue.length - 10} more`);
    }

    // Re-enqueue in batches
    logger.info(`\n🚀 Step 2: Re-enqueueing ${termsToRequeue.length} jobs in batches of ${BATCH_SIZE}...`);
    let enqueued = 0;

    for (let i = 0; i < termsToRequeue.length; i += BATCH_SIZE) {
      const batch = termsToRequeue.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(termsToRequeue.length / BATCH_SIZE);

      logger.info(`   Batch ${batchNum}/${totalBatches}: Enqueueing ${batch.length} jobs...`);

      for (const term of batch) {
        try {
          await scraperQueue.add(
            'scrape-properties',
            {
              searchTerm: term,
              userId: 'requeue-analytics-fix',
              scheduled: false,
            },
            {
              priority: 4, // Higher priority since these are retries with fix
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 2000,
              },
              removeOnComplete: false,
              removeOnFail: false,
            }
          );
          enqueued++;
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`   ❌ Failed to enqueue "${term}": ${errorMessage}`);
        }
      }

      logger.info(`   ✅ Batch ${batchNum}/${totalBatches} enqueued (${enqueued} total)`);

      // Small delay between batches
      if (i + BATCH_SIZE < termsToRequeue.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    logger.info(`\n   ✅ Successfully enqueued ${enqueued} jobs`);

    // Show final status
    logger.info('\n📊 Step 3: Final queue status...');
    const [finalWaiting, finalActive, finalDelayed, finalFailed] = await Promise.all([
      scraperQueue.getWaitingCount(),
      scraperQueue.getActiveCount(),
      scraperQueue.getDelayedCount(),
      scraperQueue.getFailedCount(),
    ]);

    logger.info(`   - Waiting: ${finalWaiting}`);
    logger.info(`   - Active: ${finalActive}`);
    logger.info(`   - Delayed: ${finalDelayed}`);
    logger.info(`   - Failed: ${finalFailed}`);
    logger.info(`   - Total in queue: ${finalWaiting + finalActive + finalDelayed}`);

    logger.info('\n✅ Re-queue complete!');
    logger.info('\n📝 Note: With the analytics error handling fix in place,');
    logger.info('   these jobs should now process successfully.');
    logger.info('   Jobs will no longer fail if analytics updates have issues.\n');

    await cleanup();

  } catch (error) {
    logger.error(error as Error, '\n❌ Script failed');
    await cleanup();
    process.exit(1);
  }
}

async function cleanup() {
  logger.info('Cleaning up...');
  await scraperQueue.close();
  await prisma.$disconnect();
  logger.info('Cleanup complete');
}

main().catch(async (error) => {
  logger.error('Fatal error:', error);
  await cleanup();
  process.exit(1);
});
