#!/usr/bin/env npx tsx

import { scraperQueue } from './src/queues/scraper.queue';
import { prisma } from './src/lib/prisma';
import { removeDuplicatesFromQueue } from './src/utils/deduplication';

async function removeAllDuplicates() {
  console.log('🧹 Removing ALL Duplicate Search Terms from Queue\n');
  console.log('=' .repeat(60));

  // Use shared deduplication utility
  await removeDuplicatesFromQueue({ verbose: true, showProgress: true });

  // Get updated queue stats
  const [waiting, active, delayed, completed, failedCount] = await Promise.all([
    scraperQueue.getWaitingCount(),
    scraperQueue.getActiveCount(),
    scraperQueue.getDelayedCount(),
    scraperQueue.getCompletedCount(),
    scraperQueue.getFailedCount(),
  ]);

  console.log(`\n📊 Final Queue Status:`);
  console.log(`   - Waiting: ${waiting}`);
  console.log(`   - Active: ${active}`);
  console.log(`   - Delayed: ${delayed}`);
  console.log(`   - Completed: ${completed}`);
  console.log(`   - Failed: ${failedCount}`);

  console.log('\n' + '=' .repeat(60));

  await prisma.$disconnect();
}

removeAllDuplicates()
  .then(() => {
    console.log('\n🎉 All duplicates removed! Queue fully optimized.');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Cleanup failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
