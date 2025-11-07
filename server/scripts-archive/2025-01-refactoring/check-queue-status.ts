#!/usr/bin/env npx tsx

import { scraperQueue } from './src/queues/scraper.queue';
import { prisma } from './src/lib/prisma';

async function checkQueueStatus() {
  console.log('\n📊 Queue Status\n');
  console.log('=' .repeat(60));

  const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
    scraperQueue.getWaitingCount(),
    scraperQueue.getActiveCount(),
    scraperQueue.getCompletedCount(),
    scraperQueue.getFailedCount(),
    scraperQueue.getDelayedCount(),
    scraperQueue.getPausedCount(),
  ]);

  const total = waiting + active + delayed + paused;

  console.log(`\n🔢 Queue Counts:`);
  console.log(`  ⏳ Waiting:     ${waiting.toString().padStart(6)}`);
  console.log(`  🔄 Active:      ${active.toString().padStart(6)}`);
  console.log(`  ⏸️  Delayed:     ${delayed.toString().padStart(6)}`);
  console.log(`  ⏸️  Paused:      ${paused.toString().padStart(6)}`);
  console.log(`  ─────────────────────`);
  console.log(`  📋 Total Pending: ${total.toString().padStart(4)}`);
  console.log(``);
  console.log(`  ✅ Completed:   ${completed.toString().padStart(6)}`);
  console.log(`  ❌ Failed:      ${failed.toString().padStart(6)}`);

  // Get sample of waiting jobs if any
  if (waiting > 0) {
    const waitingJobs = await scraperQueue.getWaiting(0, 10);
    console.log(`\n📝 Sample of Waiting Jobs (first 10):`);
    waitingJobs.forEach((job, idx) => {
      console.log(`  ${idx + 1}. "${job.data.searchTerm}"`);
    });
  }

  // Get active jobs if any
  if (active > 0) {
    const activeJobs = await scraperQueue.getActive(0, 10);
    console.log(`\n🔄 Currently Processing (first 10):`);
    activeJobs.forEach((job, idx) => {
      console.log(`  ${idx + 1}. "${job.data.searchTerm}"`);
    });
  }

  console.log('\n' + '=' .repeat(60));

  await prisma.$disconnect();
}

checkQueueStatus().then(() => process.exit(0)).catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});
