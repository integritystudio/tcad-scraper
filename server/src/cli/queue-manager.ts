#!/usr/bin/env npx tsx

import { Command } from 'commander';
import { scraperQueue } from '../queues/scraper.queue';
import { prisma } from '../lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();

program
  .name('queue-manager')
  .description('Manage scraper job queue - consolidates queue management utilities')
  .version('1.0.0');

/**
 * Add search terms to queue from file
 */
program
  .command('add-terms')
  .description('Add search terms from file to queue')
  .argument('<file>', 'Path to file with one term per line')
  .option('-p, --priority', 'Add as priority jobs (highest priority)')
  .option('-d, --dedupe', 'Remove duplicates from database first')
  .option('--priority-level <level>', 'Set priority level (1-10, lower is higher priority)', '10')
  .action(async (file: string, options: any) => {
    console.log('📝 Adding Search Terms to Queue\n');
    console.log('='.repeat(60));

    const filePath = path.resolve(file);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Error: File not found: ${filePath}`);
      process.exit(1);
    }

    // Read terms from file
    const content = fs.readFileSync(filePath, 'utf-8');
    const terms = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));

    console.log(`📄 File: ${path.basename(filePath)}`);
    console.log(`📊 Found ${terms.length} search terms`);

    // Dedupe if requested
    if (options.dedupe) {
      console.log('\n🔍 Checking for existing search terms in database...');
      const existing = await prisma.scrapeJob.findMany({
        where: { searchTerm: { in: terms } },
        select: { searchTerm: true },
        distinct: ['searchTerm']
      });
      const existingSet = new Set(existing.map(j => j.searchTerm));
      const newTerms = terms.filter(t => !existingSet.has(t));
      console.log(`   - Existing terms (skipped): ${existing.length}`);
      console.log(`   - New terms to add: ${newTerms.length}`);

      if (newTerms.length === 0) {
        console.log('\n✅ No new terms to add (all already in database)');
        await cleanup();
        return;
      }
      // Use only new terms
      terms.length = 0;
      terms.push(...newTerms);
    }

    const priorityLevel = options.priority ? 1 : parseInt(options.priorityLevel);

    console.log(`\n🚀 Adding ${terms.length} jobs to queue...`);
    console.log(`   Priority: ${priorityLevel} ${options.priority ? '(highest)' : ''}`);

    let added = 0;
    for (const term of terms) {
      try {
        await scraperQueue.add(
          'scrape-properties',
          {
            searchTerm: term,
            userId: 'cli-queue-manager',
            scheduled: false,
          },
          {
            priority: priorityLevel,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          }
        );
        added++;
        if (added % 10 === 0) {
          process.stdout.write(`\r   Progress: ${added}/${terms.length} (${((added/terms.length)*100).toFixed(1)}%)`);
        }
      } catch (error: any) {
        console.error(`\n   ❌ Failed to add "${term}":`, error.message);
      }
    }

    console.log(`\n\n✅ Added ${added} jobs to queue!`);

    // Show queue status
    const [waiting, active] = await Promise.all([
      scraperQueue.getWaitingCount(),
      scraperQueue.getActiveCount(),
    ]);

    console.log(`\n📊 Queue Status:`);
    console.log(`   - Waiting: ${waiting}`);
    console.log(`   - Active: ${active}`);

    await cleanup();
  });

/**
 * Stop all pending/waiting jobs
 */
program
  .command('stop')
  .description('Stop all pending jobs in queue (active jobs will complete)')
  .option('--force', 'Also attempt to fail active jobs')
  .action(async (options: any) => {
    console.log('🛑 Stopping All Jobs in Queue\n');
    console.log('='.repeat(60));

    // Get current queue stats
    const [waiting, active, delayed] = await Promise.all([
      scraperQueue.getWaitingCount(),
      scraperQueue.getActiveCount(),
      scraperQueue.getDelayedCount(),
    ]);

    console.log(`📊 Current Queue State:`);
    console.log(`   - Waiting: ${waiting}`);
    console.log(`   - Active: ${active}`);
    console.log(`   - Delayed: ${delayed}`);
    console.log(`   - Total to stop: ${waiting + delayed}\n`);

    if (waiting + delayed === 0 && !options.force) {
      console.log('✅ No pending jobs to stop (queue is empty)');

      if (active > 0) {
        console.log(`\nℹ️  Note: ${active} jobs are currently active and cannot be stopped.`);
        console.log('   They will finish processing. Use --force to attempt to fail them.');
      }
      await cleanup();
      return;
    }

    let removed = 0;
    let failed = 0;

    // Remove waiting jobs
    if (waiting > 0) {
      console.log(`📋 Removing ${waiting} waiting jobs...`);
      const waitingJobs = await scraperQueue.getWaiting();

      for (const job of waitingJobs) {
        try {
          await job.remove();
          removed++;
          if (removed % 50 === 0) {
            process.stdout.write(`\r   Progress: ${removed}/${waiting + delayed} (${((removed/(waiting + delayed))*100).toFixed(1)}%)`);
          }
        } catch (error: any) {
          failed++;
          if (failed <= 3) {
            console.error(`\n   ❌ Failed to remove job ${job.id}:`, error.message);
          }
        }
      }
    }

    // Remove delayed jobs
    if (delayed > 0) {
      console.log(`\n⏰ Removing ${delayed} delayed jobs...`);
      const delayedJobs = await scraperQueue.getDelayed();

      for (const job of delayedJobs) {
        try {
          await job.remove();
          removed++;
          if (removed % 50 === 0) {
            process.stdout.write(`\r   Progress: ${removed}/${waiting + delayed} (${((removed/(waiting + delayed))*100).toFixed(1)}%)`);
          }
        } catch (error: any) {
          failed++;
          if (failed <= 3) {
            console.error(`\n   ❌ Failed to remove job ${job.id}:`, error.message);
          }
        }
      }
    }

    // Force-fail active jobs if requested
    if (options.force && active > 0) {
      console.log(`\n⚠️  Force-failing ${active} active jobs...`);
      const activeJobs = await scraperQueue.getActive();

      for (const job of activeJobs) {
        try {
          await job.moveToFailed(new Error('Force-stopped by CLI'), '0');
          removed++;
          if (removed % 10 === 0) {
            process.stdout.write(`\r   Progress: ${removed}/${waiting + delayed + active} jobs`);
          }
        } catch (error: any) {
          failed++;
          if (failed <= 3) {
            console.error(`\n   ❌ Failed to stop job ${job.id}:`, error.message);
          }
        }
      }
    }

    console.log(`\n\n✅ Jobs stopped!`);
    console.log(`   - Successfully stopped: ${removed}`);
    console.log(`   - Failed to stop: ${failed}`);

    // Get final queue stats
    const [finalWaiting, finalActive, finalDelayed] = await Promise.all([
      scraperQueue.getWaitingCount(),
      scraperQueue.getActiveCount(),
      scraperQueue.getDelayedCount(),
    ]);

    console.log(`\n📊 Final Queue Status:`);
    console.log(`   - Waiting: ${finalWaiting}`);
    console.log(`   - Active: ${finalActive}`);
    console.log(`   - Delayed: ${finalDelayed}`);

    await cleanup();
  });

/**
 * Cleanup queue - remove failed/completed jobs
 */
program
  .command('cleanup')
  .description('Clean up queue by removing old jobs')
  .option('--aggressive', 'Remove all completed and failed jobs')
  .option('--older-than <days>', 'Remove jobs older than N days', '7')
  .option('--zero-results', 'Remove waiting jobs for terms that previously returned zero results')
  .action(async (options: any) => {
    console.log('🧹 Queue Cleanup\n');
    console.log('='.repeat(60));

    let totalRemoved = 0;
    let totalFailed = 0;

    // Aggressive cleanup - remove all completed/failed
    if (options.aggressive) {
      console.log('\n⚠️  AGGRESSIVE MODE: Removing ALL completed and failed jobs...');

      const [completedCount, failedCount] = await Promise.all([
        scraperQueue.getCompletedCount(),
        scraperQueue.getFailedCount(),
      ]);

      console.log(`   - Completed jobs: ${completedCount}`);
      console.log(`   - Failed jobs: ${failedCount}`);
      console.log(`   - Total to remove: ${completedCount + failedCount}`);

      if (completedCount + failedCount === 0) {
        console.log('\n✅ No jobs to clean up!');
        await cleanup();
        return;
      }

      console.log('\n🚀 Removing jobs...');
      const [removedCompleted, removedFailed] = await Promise.all([
        scraperQueue.clean(0, 0, 'completed'),
        scraperQueue.clean(0, 0, 'failed'),
      ]);

      totalRemoved = removedCompleted.length + removedFailed.length;
      console.log(`\n✅ Removed ${totalRemoved} jobs (${removedCompleted.length} completed, ${removedFailed.length} failed)`);
    }

    // Remove jobs older than N days
    if (!options.aggressive && options.olderThan) {
      const days = parseInt(options.olderThan);
      const timestamp = Date.now() - (days * 24 * 60 * 60 * 1000);

      console.log(`\n📅 Removing jobs older than ${days} days...`);

      const [removedCompleted, removedFailed] = await Promise.all([
        scraperQueue.clean(timestamp, 0, 'completed'),
        scraperQueue.clean(timestamp, 0, 'failed'),
      ]);

      totalRemoved = removedCompleted.length + removedFailed.length;
      console.log(`   ✅ Removed ${totalRemoved} old jobs`);
    }

    // Zero results cleanup
    if (options.zeroResults) {
      console.log('\n🔍 Finding terms with zero results...');

      const emptyJobs = await prisma.scrapeJob.findMany({
        where: {
          status: 'completed',
          resultCount: 0
        },
        select: { searchTerm: true },
        distinct: ['searchTerm']
      });

      const emptyTerms = new Set(emptyJobs.map(j => j.searchTerm));
      console.log(`   Found ${emptyTerms.size} terms that returned zero results`);

      const waitingJobs = await scraperQueue.getWaiting();
      const jobsToRemove = waitingJobs.filter(job =>
        emptyTerms.has(job.data.searchTerm)
      );

      console.log(`   Found ${jobsToRemove.length} waiting jobs to remove`);

      if (jobsToRemove.length > 0) {
        console.log('\n🗑️  Removing zero-result jobs...');
        let removed = 0;

        for (const job of jobsToRemove) {
          try {
            await job.remove();
            removed++;
            if (removed % 20 === 0) {
              process.stdout.write(`\r   Progress: ${removed}/${jobsToRemove.length} (${((removed/jobsToRemove.length)*100).toFixed(1)}%)`);
            }
          } catch (error: any) {
            totalFailed++;
          }
        }

        console.log(`\n   ✅ Removed ${removed} zero-result jobs`);
        totalRemoved += removed;
      }
    }

    // Show final stats
    const [waiting, active, completed, failed] = await Promise.all([
      scraperQueue.getWaitingCount(),
      scraperQueue.getActiveCount(),
      scraperQueue.getCompletedCount(),
      scraperQueue.getFailedCount(),
    ]);

    console.log(`\n📊 Final Queue Status:`);
    console.log(`   - Waiting: ${waiting}`);
    console.log(`   - Active: ${active}`);
    console.log(`   - Completed: ${completed}`);
    console.log(`   - Failed: ${failed}`);
    console.log(`\n✨ Cleanup complete! Removed ${totalRemoved} jobs.`);

    await cleanup();
  });

/**
 * Show queue status
 */
program
  .command('status')
  .description('Show current queue status with job counts')
  .option('--detailed', 'Show detailed information about recent jobs')
  .action(async (options: any) => {
    console.log('📊 Queue Status\n');
    console.log('='.repeat(60));

    const [waiting, active, delayed, completed, failed, paused] = await Promise.all([
      scraperQueue.getWaitingCount(),
      scraperQueue.getActiveCount(),
      scraperQueue.getDelayedCount(),
      scraperQueue.getCompletedCount(),
      scraperQueue.getFailedCount(),
      scraperQueue.isPaused(),
    ]);

    console.log(`\n🔢 Job Counts:`);
    console.log(`   - Waiting: ${waiting}`);
    console.log(`   - Active: ${active}`);
    console.log(`   - Delayed: ${delayed}`);
    console.log(`   - Completed: ${completed}`);
    console.log(`   - Failed: ${failed}`);
    console.log(`   - Paused: ${paused ? 'Yes' : 'No'}`);
    console.log(`   - Total: ${waiting + active + delayed + completed + failed}`);

    if (options.detailed) {
      console.log(`\n📝 Recent Jobs:`);

      // Show recent active jobs
      if (active > 0) {
        const activeJobs = await scraperQueue.getActive(0, 5);
        console.log(`\n   Active Jobs (${Math.min(5, active)}):`);
        activeJobs.forEach((job, idx) => {
          console.log(`   ${idx + 1}. "${job.data.searchTerm}" (ID: ${job.id})`);
        });
      }

      // Show recent waiting jobs
      if (waiting > 0) {
        const waitingJobs = await scraperQueue.getWaiting(0, 5);
        console.log(`\n   Waiting Jobs (showing ${Math.min(5, waiting)}):`);
        waitingJobs.forEach((job, idx) => {
          console.log(`   ${idx + 1}. "${job.data.searchTerm}" (Priority: ${job.opts.priority || 10})`);
        });
      }

      // Show recent failed jobs
      if (failed > 0) {
        const failedJobs = await scraperQueue.getFailed(0, 3);
        console.log(`\n   Recent Failed Jobs (showing ${Math.min(3, failed)}):`);
        failedJobs.forEach((job, idx) => {
          console.log(`   ${idx + 1}. "${job.data.searchTerm}" - ${job.failedReason || 'Unknown error'}`);
        });
      }
    }

    console.log('');
    await cleanup();
  });

/**
 * Pause/resume queue processing
 */
program
  .command('pause')
  .description('Pause queue processing')
  .action(async () => {
    console.log('⏸️  Pausing queue...');
    await scraperQueue.pause();
    console.log('✅ Queue paused. Jobs will not be processed until resumed.');
    await cleanup();
  });

program
  .command('resume')
  .description('Resume queue processing')
  .action(async () => {
    console.log('▶️  Resuming queue...');
    await scraperQueue.resume();
    console.log('✅ Queue resumed. Processing will continue.');
    await cleanup();
  });

/**
 * Helper function to cleanup connections
 */
async function cleanup() {
  await scraperQueue.close();
  await prisma.$disconnect();
}

// Handle errors and cleanup
process.on('SIGINT', async () => {
  console.log('\n\n👋 Interrupted. Cleaning up...');
  await cleanup();
  process.exit(0);
});

process.on('unhandledRejection', async (error: any) => {
  console.error('\n❌ Unhandled error:', error.message);
  await cleanup();
  process.exit(1);
});

// Parse arguments
program.parse();
