#!/usr/bin/env npx tsx

import { scraperQueue } from './src/queues/scraper.queue';
import { prisma } from './src/lib/prisma';

async function filterNumbersAndShort() {
  console.log('🔍 Filtering Numeric and Short Search Terms...\n');

  const MIN_LENGTH = 4;

  // Get all waiting jobs
  const waitingJobs = await scraperQueue.getWaiting();
  console.log(`⏳ Current waiting jobs: ${waitingJobs.length}`);

  // Filter jobs that are:
  // 1. Less than 4 characters
  // 2. Pure numbers (any length)
  const invalidJobs = waitingJobs.filter(job => {
    const term = job.data.searchTerm.trim();

    // Check if less than 4 characters
    if (term.length < MIN_LENGTH) {
      return true;
    }

    // Check if purely numeric (including decimals)
    const isPureNumber = /^\d+(\.\d+)?$/.test(term);
    if (isPureNumber) {
      return true;
    }

    return false;
  });

  console.log(`\n🗑️  Invalid search terms found: ${invalidJobs.length}`);

  if (invalidJobs.length > 0) {
    // Categorize the invalid terms
    const tooShort = invalidJobs.filter(j => j.data.searchTerm.trim().length < MIN_LENGTH);
    const pureNumbers = invalidJobs.filter(j => {
      const term = j.data.searchTerm.trim();
      return term.length >= MIN_LENGTH && /^\d+(\.\d+)?$/.test(term);
    });

    console.log(`\nBreakdown:`);
    console.log(`  - Too short (< ${MIN_LENGTH} chars): ${tooShort.length} jobs`);
    if (tooShort.length > 0) {
      console.log(`    Examples: ${tooShort.slice(0, 10).map(j => `"${j.data.searchTerm}"`).join(', ')}`);
    }

    console.log(`  - Pure numbers: ${pureNumbers.length} jobs`);
    if (pureNumbers.length > 0) {
      console.log(`    Examples: ${pureNumbers.slice(0, 10).map(j => `"${j.data.searchTerm}"`).join(', ')}`);
    }

    // Remove the jobs
    console.log(`\n🚀 Removing ${invalidJobs.length} invalid search terms...`);
    let removed = 0;
    let failed = 0;

    for (const job of invalidJobs) {
      try {
        await job.remove();
        removed++;
        if (removed % 10 === 0) {
          process.stdout.write(`\r  Removed: ${removed}/${invalidJobs.length}`);
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
    console.log('\n✅ No invalid search terms found!');
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
  const remainingJobs = await scraperQueue.getWaiting(0, 20);
  console.log(`\n📝 Sample of remaining valid search terms:`);
  remainingJobs.forEach((job, idx) => {
    const term = job.data.searchTerm;
    const hasLetters = /[a-zA-Z]/.test(term);
    const hasNumbers = /\d/.test(term);
    let type = '';
    if (hasLetters && hasNumbers) {
      type = '(mixed)';
    } else if (hasLetters) {
      type = '(text)';
    }
    console.log(`  ${idx + 1}. "${term}" ${type}`);
  });

  await prisma.$disconnect();
}

filterNumbersAndShort()
  .then(() => {
    console.log('\n✨ Filtering complete!');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Filtering failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
