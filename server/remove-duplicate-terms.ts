#!/usr/bin/env npx tsx

import { scraperQueue } from './src/queues/scraper.queue';
import { prisma } from './src/lib/prisma';

async function removeDuplicateTerms() {
  console.log('🧹 Removing Duplicate Search Terms from Queue\n');
  console.log('=' .repeat(60));

  // Get all waiting jobs
  const waitingJobs = await scraperQueue.getWaiting();
  console.log(`⏳ Current waiting jobs: ${waitingJobs.length}`);

  // Track search terms and their job IDs
  const termMap = new Map<string, Array<{ id: string; priority: number }>>();

  // Build map of search terms to job IDs
  for (const job of waitingJobs) {
    const term = job.data.searchTerm;
    if (!termMap.has(term)) {
      termMap.set(term, []);
    }
    termMap.get(term)!.push({
      id: job.id as string,
      priority: job.opts.priority || 10
    });
  }

  // Find duplicates
  const duplicateTerms = Array.from(termMap.entries())
    .filter(([_, jobs]) => jobs.length > 1)
    .sort((a, b) => b[1].length - a[1].length); // Sort by most duplicates first

  console.log(`\n📊 Analysis:`);
  console.log(`  🔍 Unique terms: ${termMap.size}`);
  console.log(`  ❌ Terms with duplicates: ${duplicateTerms.length}`);

  if (duplicateTerms.length === 0) {
    console.log('\n✅ No duplicates found in queue!');
  } else {
    let totalDuplicates = 0;
    for (const [_, jobs] of duplicateTerms) {
      totalDuplicates += jobs.length - 1; // -1 because we keep one
    }
    console.log(`  🗑️  Total duplicate jobs to remove: ${totalDuplicates}`);

    // Show sample of duplicates
    console.log('\n📝 Terms with duplicates (showing top 20):');
    duplicateTerms.slice(0, 20).forEach(([term, jobs]) => {
      console.log(`  "${term}": ${jobs.length} copies (keeping highest priority, removing ${jobs.length - 1})`);
    });

    // Remove duplicates
    console.log(`\n🚀 Removing ${totalDuplicates} duplicate jobs...`);
    let removed = 0;
    let failed = 0;

    for (const [term, jobs] of duplicateTerms) {
      // Sort by priority (lower number = higher priority), keep the first one
      jobs.sort((a, b) => a.priority - b.priority);

      // Remove all but the first (highest priority) job
      for (let i = 1; i < jobs.length; i++) {
        try {
          const job = await scraperQueue.getJob(jobs[i].id);
          if (job) {
            await job.remove();
            removed++;
            if (removed % 10 === 0) {
              process.stdout.write(`\r  Progress: ${removed}/${totalDuplicates} (${((removed/totalDuplicates)*100).toFixed(1)}%)`);
            }
          }
        } catch (error: any) {
          failed++;
          if (failed <= 5) {
            console.error(`\n  ❌ Failed to remove job ${jobs[i].id}:`, error.message);
          }
        }
      }
    }

    console.log(`\n\n✅ Deduplication complete!`);
    console.log(`  - Successfully removed: ${removed}`);
    console.log(`  - Failed to remove: ${failed}`);
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

  console.log('\n' + '=' .repeat(60));

  await prisma.$disconnect();
}

removeDuplicateTerms()
  .then(() => {
    console.log('\n🎉 Duplicates removed! Queue optimized.');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Deduplication failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
