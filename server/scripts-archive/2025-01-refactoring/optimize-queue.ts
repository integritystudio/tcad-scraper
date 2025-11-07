#!/usr/bin/env npx tsx

import { prisma } from './src/lib/prisma';
import { scraperQueue } from './src/queues/scraper.queue';

async function optimizeQueue() {
  console.log('🔧 Optimizing Queue...\n');

  // Get failed search terms
  const failedJobs = await prisma.scrapeJob.findMany({
    where: { status: 'failed' },
    select: { searchTerm: true },
    orderBy: { id: 'desc' },
    take: 100
  });

  const failedTerms = new Set(failedJobs.map(j => j.searchTerm));
  console.log(`❌ Found ${failedTerms.size} failed search terms`);

  // Get empty result search terms
  const emptyJobs = await prisma.scrapeJob.findMany({
    where: {
      status: 'completed',
      resultCount: 0
    },
    select: { searchTerm: true },
    orderBy: { id: 'desc' },
    take: 200
  });

  const emptyTerms = new Set(emptyJobs.map(j => j.searchTerm));
  console.log(`⚠️  Found ${emptyTerms.size} empty result search terms`);

  // Combine problematic terms
  const problematicTerms = new Set([...failedTerms, ...emptyTerms]);
  console.log(`🎯 Total problematic search terms: ${problematicTerms.size}\n`);

  // Get waiting jobs
  const waitingJobs = await scraperQueue.getWaiting();
  console.log(`⏳ Current waiting jobs: ${waitingJobs.length}`);

  // Identify jobs to remove
  const jobsToRemove = waitingJobs.filter(job =>
    problematicTerms.has(job.data.searchTerm)
  );

  console.log(`\n🗑️  Jobs to remove: ${jobsToRemove.length}`);
  console.log('Terms to remove:', jobsToRemove.map(j => j.data.searchTerm).slice(0, 20));

  // Remove the jobs
  let removed = 0;
  let failed = 0;

  console.log('\n🚀 Starting removal...');
  for (const job of jobsToRemove) {
    try {
      await job.remove();
      removed++;
      if (removed % 5 === 0) {
        process.stdout.write(`\r  Removed: ${removed}/${jobsToRemove.length}`);
      }
    } catch (error) {
      failed++;
      console.error(`\n  ❌ Failed to remove job ${job.id}:`, error.message);
    }
  }

  console.log(`\n\n✅ Removal complete!`);
  console.log(`  - Successfully removed: ${removed}`);
  console.log(`  - Failed to remove: ${failed}`);

  // Get updated queue stats
  const [waiting, active, completed, failedCount] = await Promise.all([
    scraperQueue.getWaitingCount(),
    scraperQueue.getActiveCount(),
    scraperQueue.getCompletedCount(),
    scraperQueue.getFailedCount(),
  ]);

  console.log(`\n📊 Updated Queue Status:`);
  console.log(`  - Waiting: ${waiting}`);
  console.log(`  - Active: ${active}`);
  console.log(`  - Completed: ${completed}`);
  console.log(`  - Failed: ${failedCount}`);

  await prisma.$disconnect();
}

optimizeQueue()
  .then(() => {
    console.log('\n✨ Queue optimization complete!');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Optimization failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
