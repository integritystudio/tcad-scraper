#!/usr/bin/env npx tsx

import { scraperQueue } from './src/queues/scraper.queue';
import { prisma } from './src/lib/prisma';

async function filterShortTerms() {
  console.log('🔍 Filtering Search Terms by Length...\n');

  const MIN_LENGTH = 4;

  // Get all waiting jobs
  const waitingJobs = await scraperQueue.getWaiting();
  console.log(`⏳ Current waiting jobs: ${waitingJobs.length}`);

  // Filter jobs with search terms less than MIN_LENGTH characters
  const shortTermJobs = waitingJobs.filter(job =>
    job.data.searchTerm.length < MIN_LENGTH
  );

  console.log(`\n🗑️  Jobs with search terms < ${MIN_LENGTH} characters: ${shortTermJobs.length}`);

  if (shortTermJobs.length > 0) {
    // Group by length for reporting
    const byLength = new Map<number, string[]>();
    shortTermJobs.forEach(job => {
      const len = job.data.searchTerm.length;
      if (!byLength.has(len)) {
        byLength.set(len, []);
      }
      byLength.get(len)!.push(job.data.searchTerm);
    });

    console.log('\nBreakdown by length:');
    Array.from(byLength.keys()).sort().forEach(len => {
      const terms = byLength.get(len)!;
      console.log(`  ${len} chars: ${terms.length} jobs`);
      console.log(`    Examples: ${terms.slice(0, 10).join(', ')}`);
    });

    // Remove the jobs
    console.log(`\n🚀 Removing ${shortTermJobs.length} jobs with short search terms...`);
    let removed = 0;
    let failed = 0;

    for (const job of shortTermJobs) {
      try {
        await job.remove();
        removed++;
        if (removed % 10 === 0) {
          process.stdout.write(`\r  Removed: ${removed}/${shortTermJobs.length}`);
        }
      } catch (error) {
        failed++;
        console.error(`\n  ❌ Failed to remove job ${job.id}:`, error.message);
      }
    }

    console.log(`\n\n✅ Removal complete!`);
    console.log(`  - Successfully removed: ${removed}`);
    console.log(`  - Failed to remove: ${failed}`);
  } else {
    console.log('\n✅ No short search terms found!');
  }

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

  // Show some examples of remaining search terms
  const remainingJobs = await scraperQueue.getWaiting(0, 10);
  console.log(`\n📝 Sample of remaining search terms:`);
  remainingJobs.forEach((job, idx) => {
    console.log(`  ${idx + 1}. "${job.data.searchTerm}" (${job.data.searchTerm.length} chars)`);
  });

  await prisma.$disconnect();
}

filterShortTerms()
  .then(() => {
    console.log('\n✨ Search term filtering complete!');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Filtering failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
