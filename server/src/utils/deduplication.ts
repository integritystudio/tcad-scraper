import { scraperQueue } from '../queues/scraper.queue';
import { prisma } from '../lib/prisma';
import logger from '../lib/logger';
import type { ScraperJob } from '../types/queue.types';

interface DeduplicationOptions {
  verbose?: boolean;
  showProgress?: boolean;
}

export async function removeDuplicatesFromQueue(options: DeduplicationOptions = {}) {
  const { verbose = true, showProgress = true } = options;

  if (verbose) {
    logger.info('🔍 Now checking for duplicates...\n');
  }

  // Get all pending jobs (waiting + delayed)
  const [waitingJobs, delayedJobs] = await Promise.all([
    scraperQueue.getWaiting(),
    scraperQueue.getDelayed(),
  ]);

  const allPendingJobs = [...waitingJobs, ...delayedJobs];

  if (verbose) {
    logger.info(`📊 Queue State:`);
    logger.info(`   Waiting: ${waitingJobs.length}`);
    logger.info(`   Delayed: ${delayedJobs.length}`);
    logger.info(`   Total Pending: ${allPendingJobs.length}\n`);
  }

  // Get completed search terms from database
  const completedTerms = await prisma.scrapeJob.findMany({
    where: { status: 'completed' },
    select: { searchTerm: true },
    distinct: ['searchTerm'],
  });

  const completedTermSet = new Set(completedTerms.map(j => j.searchTerm));

  // Track search terms and their job IDs
  const termMap = new Map<string, Array<{ job: ScraperJob; priority: number; state: string }>>();

  // Build map of search terms to jobs
  for (const job of allPendingJobs) {
    const term = job.data.searchTerm;
    let state = 'waiting';
    if (delayedJobs.includes(job)) state = 'delayed';

    if (!termMap.has(term)) {
      termMap.set(term, []);
    }
    termMap.get(term)!.push({
      job,
      priority: job.opts.priority || 10,
      state
    });
  }

  // Find duplicates within pending jobs
  const duplicateTerms = Array.from(termMap.entries())
    .filter(([_, jobs]) => jobs.length > 1);

  // Find jobs that were already completed
  const alreadyCompletedTerms = Array.from(termMap.entries())
    .filter(([term, _]) => completedTermSet.has(term));

  if (verbose) {
    logger.info(`🔍 Analysis:`);
    logger.info(`   Unique pending terms: ${termMap.size}`);
    logger.info(`   ❌ Terms with duplicate pending jobs: ${duplicateTerms.length}`);
    logger.info(`   ✅ Terms already completed: ${alreadyCompletedTerms.length}`);
  }

  let totalToRemove = 0;

  // Count duplicates
  for (const [_, jobs] of duplicateTerms) {
    totalToRemove += jobs.length - 1; // Keep one
  }

  // Count already completed
  for (const [_, jobs] of alreadyCompletedTerms) {
    totalToRemove += jobs.length; // Remove all
  }

  if (verbose) {
    logger.info(`   🗑️  Total jobs to remove: ${totalToRemove}\n`);
  }

  if (totalToRemove === 0) {
    if (verbose) {
      logger.info('✅ No duplicates or completed terms found!');
    }
    return { removed: 0, failed: 0 };
  }

  // Show what we're removing
  if (verbose) {
    if (duplicateTerms.length > 0) {
      logger.info('📝 Duplicate pending jobs:');
      const displayCount = showProgress ? 10 : duplicateTerms.length;
      duplicateTerms.slice(0, displayCount).forEach(([term, jobs]) => {
        logger.info(`   "${term}": ${jobs.length} copies (keeping 1, removing ${jobs.length - 1})`);
      });
      if (duplicateTerms.length > displayCount) {
        logger.info(`   ... and ${duplicateTerms.length - displayCount} more`);
      }
      logger.info('');
    }

    if (alreadyCompletedTerms.length > 0) {
      logger.info('📝 Already completed terms in queue:');
      const displayCount = showProgress ? 20 : alreadyCompletedTerms.length;
      alreadyCompletedTerms.slice(0, displayCount).forEach(([term, jobs]) => {
        logger.info(`   "${term}": ${jobs.length} pending (removing all)`);
      });
      if (alreadyCompletedTerms.length > displayCount) {
        logger.info(`   ... and ${alreadyCompletedTerms.length - displayCount} more`);
      }
      logger.info('');
    }

    logger.info(`🚀 Removing ${totalToRemove} duplicate/completed jobs...`);
  }

  let removed = 0;
  let failed = 0;

  // Remove duplicates (keep highest priority)
  for (const [_term, jobs] of duplicateTerms) {
    // Sort by priority (lower number = higher priority)
    jobs.sort((a, b) => a.priority - b.priority);

    // Remove all but the first (highest priority) job
    for (let i = 1; i < jobs.length; i++) {
      try {
        await jobs[i].job.remove();
        removed++;
        if (showProgress && removed % 10 === 0) {
          process.stdout.write(`\r   Progress: ${removed}/${totalToRemove} (${((removed/totalToRemove)*100).toFixed(1)}%)`);
        }
      } catch (error: unknown) {
        failed++;
        if (verbose && failed <= 3) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`${showProgress ? '\n' : ''}   ❌ Failed to remove job ${jobs[i].job.id}: ${errorMessage}`);
        }
      }
    }
  }

  // Remove already completed terms
  for (const [_term, jobs] of alreadyCompletedTerms) {
    for (const jobInfo of jobs) {
      try {
        await jobInfo.job.remove();
        removed++;
        if (showProgress && removed % 10 === 0) {
          process.stdout.write(`\r   Progress: ${removed}/${totalToRemove} (${((removed/totalToRemove)*100).toFixed(1)}%)`);
        }
      } catch (error: unknown) {
        failed++;
        if (verbose && failed <= 3) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`${showProgress ? '\n' : ''}   ❌ Failed to remove job ${jobInfo.job.id}: ${errorMessage}`);
        }
      }
    }
  }

  if (verbose) {
    if (showProgress) {
      logger.info(''); // New line after progress
    }
    logger.info(`\n✅ Cleanup complete!`);
    logger.info(`   - Successfully removed: ${removed}`);
    logger.info(`   - Failed to remove: ${failed}`);
  }

  return { removed, failed };
}
