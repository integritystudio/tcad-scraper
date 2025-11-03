#!/usr/bin/env npx tsx

import { scraperQueue } from './src/queues/scraper.queue';
import { prisma } from './src/lib/prisma';

async function removeCompoundNames() {
  console.log('🧹 Removing Compound Name Search Terms from Queue\n');
  console.log('=' .repeat(60));

  // Patterns that indicate compound names
  const compoundPatterns = [
    /\s+&\s+/,           // "Smith & Jones"
    /\s+-\s+/,           // "Smith-Jones"
    /\s+Estate$/i,       // "Martinez Estate"
    /\s+Family$/i,       // "Johnson Family"
    /\s+Trust$/i,        // "Williams Trust"
    /\s+Foundation$/i,   // "Garcia Foundation"
  ];

  // Get all waiting jobs
  const waitingJobs = await scraperQueue.getWaiting();
  console.log(`⏳ Current waiting jobs: ${waitingJobs.length}`);

  // Identify compound name jobs
  const compoundJobs = waitingJobs.filter(job => {
    const term = job.data.searchTerm;
    return compoundPatterns.some(pattern => pattern.test(term));
  });

  const regularJobs = waitingJobs.length - compoundJobs.length;

  console.log(`\n📊 Analysis:`);
  console.log(`  ❌ Compound names to remove: ${compoundJobs.length}`);
  console.log(`  ✅ Regular terms to keep: ${regularJobs}`);

  if (compoundJobs.length > 0) {
    // Show sample of what we're removing
    const sample = compoundJobs.slice(0, 30).map(j => j.data.searchTerm);
    console.log('\n📝 Sample of terms being removed:');
    for (let i = 0; i < sample.length; i += 5) {
      console.log('  ' + sample.slice(i, i + 5).map(s => `"${s}"`).join(', '));
    }

    // Remove the jobs
    console.log(`\n🚀 Removing ${compoundJobs.length} compound name jobs...`);
    let removed = 0;
    let failed = 0;

    for (const job of compoundJobs) {
      try {
        await job.remove();
        removed++;
        if (removed % 20 === 0) {
          process.stdout.write(`\r  Progress: ${removed}/${compoundJobs.length} (${((removed/compoundJobs.length)*100).toFixed(1)}%)`);
        }
      } catch (error: any) {
        failed++;
        if (failed <= 5) {
          console.error(`\n  ❌ Failed to remove job ${job.id}:`, error.message);
        }
      }
    }

    console.log(`\n\n✅ Removal complete!`);
    console.log(`  - Successfully removed: ${removed}`);
    console.log(`  - Failed to remove: ${failed}`);
  } else {
    console.log('\n✅ No compound name jobs found in queue!');
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

  // Show remaining jobs
  const remainingJobs = await scraperQueue.getWaiting(0, 20);
  if (remainingJobs.length > 0) {
    console.log(`\n📝 Sample of remaining search terms:`);
    remainingJobs.forEach((job, idx) => {
      console.log(`  ${idx + 1}. "${job.data.searchTerm}"`);
    });
  }

  console.log('\n' + '=' .repeat(60));

  await prisma.$disconnect();
}

removeCompoundNames()
  .then(() => {
    console.log('\n🎉 Compound names removed! Queue optimized for single terms only.');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Removal failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
