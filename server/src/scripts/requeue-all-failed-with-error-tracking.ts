#!/usr/bin/env npx tsx
/**
 * Re-queue All Failed Jobs with Error Tracking
 *
 * This script:
 * 1. Analyzes all failed jobs and categorizes errors
 * 2. Saves error distribution to a JSON file for review
 * 3. Re-enqueues all failed jobs in small batches
 * 4. Maintains token refresh every 3 minutes
 */

import { scraperQueue } from '../queues/scraper.queue';
import { prisma } from '../lib/prisma';
import { tokenRefreshService } from '../services/token-refresh.service';
import logger from '../lib/logger';
import * as fs from 'fs';
import * as path from 'path';

const THREE_MINUTES_MS = 3 * 60 * 1000;
const BATCH_SIZE = 50; // Process 50 jobs at a time

interface ErrorStats {
  category: string;
  count: number;
  examples: string[];
}

async function categorizeErrors(): Promise<Map<string, ErrorStats>> {
  logger.info('📊 Analyzing failed job errors...');

  const failedJobs = await prisma.scrapeJob.findMany({
    where: {
      status: 'failed'
    },
    select: {
      error: true,
      searchTerm: true
    }
  });

  const errorMap = new Map<string, ErrorStats>();

  for (const job of failedJobs) {
    if (!job.error) continue;

    let category = 'Unknown Error';

    if (job.error.includes('HTTP 401')) {
      category = 'HTTP 401 Unauthorized';
    } else if (job.error.includes('HTTP 409')) {
      category = 'HTTP 409 Conflict (Rate Limit)';
    } else if (job.error.includes('HTTP 504')) {
      category = 'HTTP 504 Gateway Timeout';
    } else if (job.error.includes('HTTP 500')) {
      category = 'HTTP 500 Internal Server Error';
    } else if (job.error.includes('search_term_analytics')) {
      category = 'Missing search_term_analytics Table';
    } else if (job.error.includes('Cannot affect row a second time')) {
      category = 'Duplicate Constraint Violation';
    } else if (job.error.includes('Unexpected end of JSON input')) {
      category = 'JSON Parsing Error';
    } else if (job.error.includes('Failed to intercept')) {
      category = 'API Interception Failed';
    } else if (job.error.includes('timeout')) {
      category = 'Timeout Error';
    } else if (job.error.includes('Raw query failed')) {
      category = 'Database Raw Query Error';
    } else {
      // Use first 80 chars as category for other errors
      category = job.error.substring(0, 80).replace(/\n/g, ' ');
    }

    if (!errorMap.has(category)) {
      errorMap.set(category, {
        category,
        count: 0,
        examples: []
      });
    }

    const stats = errorMap.get(category)!;
    stats.count++;

    // Keep up to 5 example search terms for each error category
    if (stats.examples.length < 5) {
      stats.examples.push(job.searchTerm);
    }
  }

  return errorMap;
}

async function saveErrorReport(errorMap: Map<string, ErrorStats>): Promise<string> {
  const reportData = {
    timestamp: new Date().toISOString(),
    totalFailedJobs: Array.from(errorMap.values()).reduce((sum, stat) => sum + stat.count, 0),
    errorBreakdown: Array.from(errorMap.values()).sort((a, b) => b.count - a.count)
  };

  const reportPath = path.join(process.cwd(), 'data', `error-report-${Date.now()}.json`);

  // Ensure data directory exists
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

  return reportPath;
}

async function main() {
  logger.info('🔄 Re-queue All Failed Jobs with Error Tracking');
  logger.info('='.repeat(60));

  try {
    // Step 1: Categorize errors
    logger.info('\n📊 Step 1: Categorizing failed job errors...');
    const errorMap = await categorizeErrors();

    const totalFailed = Array.from(errorMap.values()).reduce((sum, stat) => sum + stat.count, 0);
    logger.info(`   Total failed jobs: ${totalFailed}`);
    logger.info(`   Unique error categories: ${errorMap.size}`);

    logger.info('\n   Error Breakdown:');
    Array.from(errorMap.values())
      .sort((a, b) => b.count - a.count)
      .forEach(stat => {
        const percentage = ((stat.count / totalFailed) * 100).toFixed(1);
        logger.info(`   - ${stat.category}: ${stat.count} (${percentage}%)`);
      });

    // Step 2: Save error report
    logger.info('\n💾 Step 2: Saving error report...');
    const reportPath = await saveErrorReport(errorMap);
    logger.info(`   ✅ Report saved to: ${reportPath}`);

    // Step 3: Get all unique search terms from failed jobs
    logger.info('\n📋 Step 3: Collecting unique search terms to re-queue...');
    const failedJobs = await prisma.scrapeJob.findMany({
      where: {
        status: 'failed'
      },
      select: { searchTerm: true },
      distinct: ['searchTerm']
    });

    const termsToRequeue = failedJobs.map(job => job.searchTerm);
    logger.info(`   Found ${termsToRequeue.length} unique search terms to re-queue`);

    if (termsToRequeue.length === 0) {
      logger.info('\n✅ No jobs to re-queue!');
      await cleanup();
      return;
    }

    // Step 4: Clean up failed jobs from queue
    logger.info('\n🧹 Step 4: Cleaning up failed jobs from queue...');
    const cleanedFailed = await scraperQueue.clean(0, 'failed');
    logger.info(`   ✅ Cleaned ${cleanedFailed.length} failed jobs from queue`);

    // Step 5: Refresh token
    logger.info('\n🔑 Step 5: Refreshing API token...');
    const newToken = await tokenRefreshService.refreshToken();

    if (!newToken) {
      logger.error('   ❌ Failed to refresh token!');
      await cleanup();
      process.exit(1);
    }

    logger.info(`   ✅ Token refreshed successfully (length: ${newToken.length})`);

    // Step 6: Start auto-refresh every 3 minutes
    logger.info('\n⏰ Step 6: Starting auto-refresh (every 3 minutes)...');
    tokenRefreshService.startAutoRefreshInterval(THREE_MINUTES_MS);
    logger.info('   ✅ Auto-refresh started');

    // Step 7: Re-enqueue in batches
    logger.info(`\n🚀 Step 7: Re-enqueueing ${termsToRequeue.length} jobs in batches of ${BATCH_SIZE}...`);
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
              userId: 'requeue-all-failed',
              scheduled: false,
            },
            {
              priority: 5, // Medium priority
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
        } catch (error: any) {
          logger.error(`   ❌ Failed to enqueue "${term}":`, error.message);
        }
      }

      logger.info(`   ✅ Batch ${batchNum}/${totalBatches} enqueued (${enqueued} total)`);

      // Small delay between batches to avoid overwhelming the queue
      if (i + BATCH_SIZE < termsToRequeue.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    logger.info(`\n   ✅ Enqueued ${enqueued} jobs successfully`);

    // Step 8: Show final status
    logger.info('\n📊 Step 8: Final queue status...');
    const [finalWaiting, finalActive, finalDelayed] = await Promise.all([
      scraperQueue.getWaitingCount(),
      scraperQueue.getActiveCount(),
      scraperQueue.getDelayedCount(),
    ]);

    logger.info(`   - Waiting: ${finalWaiting}`);
    logger.info(`   - Active: ${finalActive}`);
    logger.info(`   - Delayed: ${finalDelayed}`);
    logger.info(`   - Total: ${finalWaiting + finalActive + finalDelayed}`);

    logger.info('\n✅ Re-queue complete!');
    logger.info('\n📄 Error Report Summary:');
    logger.info(`   Total Failed Jobs: ${totalFailed}`);
    logger.info(`   Unique Error Categories: ${errorMap.size}`);
    logger.info(`   Report Location: ${reportPath}`);
    logger.info('\n⚠️  IMPORTANT: Auto-refresh is running every 3 minutes.');
    logger.info('   The script will continue running to maintain token refresh.');
    logger.info('   Press Ctrl+C to stop when done.\n');

    // Keep the script running to maintain auto-refresh
    process.on('SIGINT', async () => {
      logger.info('\n\n👋 Shutting down...');
      await cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('\n\n👋 Shutting down...');
      await cleanup();
      process.exit(0);
    });

    // Keep process alive
    await new Promise(() => {});

  } catch (error) {
    logger.error(error as Error, '\n❌ Script failed');
    await cleanup();
    process.exit(1);
  }
}

async function cleanup() {
  logger.info('Cleaning up...');
  await tokenRefreshService.cleanup();
  await scraperQueue.close();
  await prisma.$disconnect();
  logger.info('Cleanup complete');
}

main().catch(async (error) => {
  logger.error('Fatal error:', error);
  await cleanup();
  process.exit(1);
});
