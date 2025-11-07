#!/usr/bin/env npx tsx

import { scraperQueue } from './src/queues/scraper.queue';
import { prisma } from './src/lib/prisma';

async function stopAllJobs() {
  console.log('🛑 Stopping All Jobs in Queue\n');
  console.log('=' .repeat(60));

  // Get current queue stats
  const [waiting, active, delayed] = await Promise.all([
    scraperQueue.getWaitingCount(),
    scraperQueue.getActiveCount(),
    scraperQueue.getDelayedCount(),
  ]);

  console.log(`📊 Current Queue State:`);
  console.log(`   Waiting: ${waiting}`);
  console.log(`   Active: ${active}`);
  console.log(`   Delayed: ${delayed}`);
  console.log(`   Total to stop: ${waiting + delayed}\n`);

  if (waiting + delayed === 0) {
    console.log('✅ No jobs to stop (queue is empty)');

    if (active > 0) {
      console.log(`\nℹ️  Note: ${active} jobs are currently active and cannot be stopped.`);
      console.log('   They will finish processing.');
    }
  } else {
    console.log(`🚀 Removing ${waiting + delayed} pending jobs...\n`);

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

    console.log(`\n\n✅ Jobs stopped!`);
    console.log(`   - Successfully removed: ${removed}`);
    console.log(`   - Failed to remove: ${failed}`);

    if (active > 0) {
      console.log(`\nℹ️  Note: ${active} jobs are still active and processing.`);
      console.log('   They cannot be stopped mid-execution.');
    }
  }

  // Get final queue stats
  const [finalWaiting, finalActive, finalDelayed, completed, failedCount] = await Promise.all([
    scraperQueue.getWaitingCount(),
    scraperQueue.getActiveCount(),
    scraperQueue.getDelayedCount(),
    scraperQueue.getCompletedCount(),
    scraperQueue.getFailedCount(),
  ]);

  console.log(`\n📊 Final Queue Status:`);
  console.log(`   - Waiting: ${finalWaiting}`);
  console.log(`   - Active: ${finalActive}`);
  console.log(`   - Delayed: ${finalDelayed}`);
  console.log(`   - Completed: ${completed}`);
  console.log(`   - Failed: ${failedCount}`);

  console.log('\n' + '=' .repeat(60));

  await prisma.$disconnect();
}

stopAllJobs()
  .then(() => {
    console.log('\n🎉 Queue stopped successfully!');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Failed to stop jobs:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
