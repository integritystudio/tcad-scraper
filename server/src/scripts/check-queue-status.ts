#!/usr/bin/env node
/**
 * Check Queue Status
 * Displays current status of all jobs in the scraper queue
 */

import { scraperQueue } from '../queues/scraper.queue';
import logger from '../lib/logger';

async function checkQueueStatus() {
  try {
    logger.info('📊 Checking Scraper Queue Status...\n');

    // Get job counts by status
    const [
      waiting,
      active,
      completed,
      failed,
      delayed,
      isPaused
    ] = await Promise.all([
      scraperQueue.getWaiting(),
      scraperQueue.getActive(),
      scraperQueue.getCompleted(),
      scraperQueue.getFailed(),
      scraperQueue.getDelayed(),
      scraperQueue.isPaused()
    ]);

    // Get counts
    const counts = {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused: isPaused ? 1 : 0
    };

    logger.info('='.repeat(60));
    logger.info('📈 QUEUE SUMMARY');
    logger.info('='.repeat(60));
    logger.info(`⏳ Waiting:   ${counts.waiting}`);
    logger.info(`⚡ Active:    ${counts.active}`);
    logger.info(`✅ Completed: ${counts.completed}`);
    logger.info(`❌ Failed:    ${counts.failed}`);
    logger.info(`⏸️  Delayed:   ${counts.delayed}`);
    logger.info(`⏸️  Paused:    ${counts.paused}`);
    logger.info('='.repeat(60));
    logger.info(`📊 Total:     ${counts.waiting + counts.active + counts.completed + counts.failed + counts.delayed + counts.paused}`);
    logger.info('='.repeat(60));

    // Show active jobs
    if (active.length > 0) {
      logger.info('\n⚡ ACTIVE JOBS:');
      for (const job of active.slice(0, 5)) {
        const data = job.data as any;
        logger.info(`  Job ${job.id}: "${data.searchTerm}" (Progress: ${job.progress}%)`);
      }
      if (active.length > 5) {
        logger.info(`  ... and ${active.length - 5} more`);
      }
    }

    // Show recent completed jobs
    if (completed.length > 0) {
      logger.info('\n✅ RECENT COMPLETED JOBS (last 10):');
      for (const job of completed.slice(-10).reverse()) {
        const data = job.data as any;
        const returnValue = job.returnvalue as any;
        const propertiesCount = returnValue?.propertiesCount || 0;
        logger.info(`  Job ${job.id}: "${data.searchTerm}" → ${propertiesCount} properties`);
      }
    }

    // Show recent failed jobs
    if (failed.length > 0) {
      logger.info('\n❌ RECENT FAILED JOBS (last 5):');
      for (const job of failed.slice(-5).reverse()) {
        const data = job.data as any;
        const failedReason = job.failedReason || 'Unknown error';
        logger.info(`  Job ${job.id}: "${data.searchTerm}" - ${failedReason.substring(0, 80)}`);
      }
    }

    // Show next waiting jobs
    if (waiting.length > 0) {
      logger.info('\n⏳ NEXT WAITING JOBS (first 10):');
      for (const job of waiting.slice(0, 10)) {
        const data = job.data as any;
        const priority = job.opts.priority || 3;
        logger.info(`  Job ${job.id}: "${data.searchTerm}" (Priority: ${priority})`);
      }
      if (waiting.length > 10) {
        logger.info(`  ... and ${waiting.length - 10} more`);
      }
    }

    logger.info('');

    // Cleanup
    await scraperQueue.close();
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, '❌ Error checking queue status:');
    process.exit(1);
  }
}

checkQueueStatus();
