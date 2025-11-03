#!/usr/bin/env npx tsx

import { scraperQueue } from './src/queues/scraper.queue';
import { prisma } from './src/lib/prisma';

async function filterZipcodes() {
  console.log('🔍 Filtering Zip Code Search Terms...\n');

  // Regex patterns for zip codes
  const ZIP_5_DIGIT = /^\d{5}$/;  // 78701
  const ZIP_PLUS_4 = /^\d{5}-\d{4}$/;  // 78701-1234
  const ZIP_VARIATIONS = /^(zip|zipcode|postal)?\s*\d{5}(-\d{4})?$/i;

  // Get all waiting jobs
  const waitingJobs = await scraperQueue.getWaiting();
  console.log(`⏳ Current waiting jobs: ${waitingJobs.length}`);

  // Filter jobs with zip code patterns
  const zipcodeJobs = waitingJobs.filter(job => {
    const term = job.data.searchTerm.trim();
    return ZIP_5_DIGIT.test(term) ||
           ZIP_PLUS_4.test(term) ||
           ZIP_VARIATIONS.test(term);
  });

  console.log(`\n🗑️  Jobs with zip code search terms: ${zipcodeJobs.length}`);

  if (zipcodeJobs.length > 0) {
    // Show examples
    const examples = zipcodeJobs.slice(0, 20).map(j => j.data.searchTerm);
    console.log('\nExamples of zip code terms to remove:');
    examples.forEach((term, idx) => {
      console.log(`  ${idx + 1}. "${term}"`);
    });

    // Group by pattern type
    const byPattern = {
      fiveDigit: zipcodeJobs.filter(j => ZIP_5_DIGIT.test(j.data.searchTerm.trim())),
      zipPlus4: zipcodeJobs.filter(j => ZIP_PLUS_4.test(j.data.searchTerm.trim())),
      variations: zipcodeJobs.filter(j => ZIP_VARIATIONS.test(j.data.searchTerm.trim()) &&
                                          !ZIP_5_DIGIT.test(j.data.searchTerm.trim()) &&
                                          !ZIP_PLUS_4.test(j.data.searchTerm.trim()))
    };

    console.log('\nBreakdown by pattern:');
    console.log(`  5-digit (e.g., 78701): ${byPattern.fiveDigit.length} jobs`);
    console.log(`  ZIP+4 (e.g., 78701-1234): ${byPattern.zipPlus4.length} jobs`);
    console.log(`  Variations (e.g., "zip 78701"): ${byPattern.variations.length} jobs`);

    // Remove the jobs
    console.log(`\n🚀 Removing ${zipcodeJobs.length} jobs with zip code search terms...`);
    let removed = 0;
    let failed = 0;

    for (const job of zipcodeJobs) {
      try {
        await job.remove();
        removed++;
        if (removed % 10 === 0) {
          process.stdout.write(`\r  Removed: ${removed}/${zipcodeJobs.length}`);
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
    console.log('\n✅ No zip code search terms found!');
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
  const remainingJobs = await scraperQueue.getWaiting(0, 15);
  console.log(`\n📝 Sample of remaining search terms:`);
  remainingJobs.forEach((job, idx) => {
    console.log(`  ${idx + 1}. "${job.data.searchTerm}"`);
  });

  await prisma.$disconnect();
}

filterZipcodes()
  .then(() => {
    console.log('\n✨ Zip code filtering complete!');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Filtering failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
