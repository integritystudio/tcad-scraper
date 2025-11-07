#!/usr/bin/env npx tsx

import { prisma } from './src/lib/prisma';
import { scraperQueue } from './src/queues/scraper.queue';

async function aggressiveCleanup() {
  console.log('🧹 Aggressive Queue Cleanup - Removing ALL Zero-Result Terms\n');
  console.log('=' .repeat(60));

  // Get ALL completed jobs with zero results (no limit)
  const emptyJobs = await prisma.scrapeJob.findMany({
    where: {
      status: 'completed',
      resultCount: 0
    },
    select: { searchTerm: true }
  });

  const emptyTerms = new Set(emptyJobs.map(j => j.searchTerm));
  console.log(`\n📊 Found ${emptyTerms.size} search terms that have NEVER returned results`);

  // Get ALL failed jobs
  const failedJobs = await prisma.scrapeJob.findMany({
    where: { status: 'failed' },
    select: { searchTerm: true }
  });

  const failedTerms = new Set(failedJobs.map(j => j.searchTerm));
  console.log(`📊 Found ${failedTerms.size} search terms that have FAILED`);

  // Combine all problematic terms
  const allProblematicTerms = new Set([...emptyTerms, ...failedTerms]);
  console.log(`\n🎯 Total problematic search terms: ${allProblematicTerms.size}`);

  // Get waiting jobs
  const waitingJobs = await scraperQueue.getWaiting();
  console.log(`⏳ Current waiting jobs: ${waitingJobs.length}`);

  // Identify jobs to remove
  const jobsToRemove = waitingJobs.filter(job =>
    allProblematicTerms.has(job.data.searchTerm)
  );

  console.log(`\n🗑️  Jobs to remove: ${jobsToRemove.length}`);
  console.log(`✅ Jobs to keep: ${waitingJobs.length - jobsToRemove.length}`);

  if (jobsToRemove.length > 0) {
    // Show sample of what we're removing
    const sample = jobsToRemove.slice(0, 30).map(j => j.data.searchTerm);
    console.log('\nSample of terms being removed:');
    for (let i = 0; i < sample.length; i += 5) {
      console.log('  ' + sample.slice(i, i + 5).map(s => `"${s}"`).join(', '));
    }

    // Remove the jobs
    console.log(`\n🚀 Removing ${jobsToRemove.length} jobs...`);
    let removed = 0;
    let failed = 0;

    for (const job of jobsToRemove) {
      try {
        await job.remove();
        removed++;
        if (removed % 20 === 0) {
          process.stdout.write(`\r  Progress: ${removed}/${jobsToRemove.length} (${((removed/jobsToRemove.length)*100).toFixed(1)}%)`);
        }
      } catch (error) {
        failed++;
        if (failed <= 5) {
          console.error(`\n  ❌ Failed to remove job ${job.id}:`, error.message);
        }
      }
    }

    console.log(`\n\n✅ Cleanup complete!`);
    console.log(`  - Successfully removed: ${removed}`);
    console.log(`  - Failed to remove: ${failed}`);
  } else {
    console.log('\n✅ No problematic jobs found in queue!');
  }

  // Get updated queue stats
  const [waiting, active, completed, failedCount] = await Promise.all([
    scraperQueue.getWaitingCount(),
    scraperQueue.getActiveCount(),
    scraperQueue.getCompletedCount(),
    scraperQueue.getFailedCount(),
  ]);

  console.log(`\n📊 Final Queue Status:`);
  console.log(`  - Waiting: ${waiting}`);
  console.log(`  - Active: ${active}`);
  console.log(`  - Completed: ${completed}`);
  console.log(`  - Failed: ${failedCount}`);

  // Analyze remaining jobs
  const remainingJobs = await scraperQueue.getWaiting(0, 20);
  if (remainingJobs.length > 0) {
    console.log(`\n📝 Sample of remaining high-quality search terms:`);
    remainingJobs.forEach((job, idx) => {
      console.log(`  ${idx + 1}. "${job.data.searchTerm}"`);
    });

    // Check success rate of remaining terms
    const remainingTerms = remainingJobs.map(j => j.data.searchTerm);
    const successfulJobs = await prisma.scrapeJob.findMany({
      where: {
        searchTerm: { in: remainingTerms },
        status: 'completed',
        resultCount: { gt: 0 }
      },
      select: {
        searchTerm: true,
        resultCount: true
      }
    });

    if (successfulJobs.length > 0) {
      console.log(`\n✨ Sample terms have proven successful before:`);
      successfulJobs.slice(0, 5).forEach(job => {
        console.log(`  "${job.searchTerm}": ${job.resultCount} properties`);
      });
    }
  }

  console.log('\n' + '=' .repeat(60));

  await prisma.$disconnect();
}

aggressiveCleanup()
  .then(() => {
    console.log('\n🎉 Aggressive cleanup complete! Queue is now optimized for maximum success rate.');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Cleanup failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
