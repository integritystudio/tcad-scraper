#!/usr/bin/env npx tsx

import { scraperQueue } from './src/queues/scraper.queue';
import { prisma } from './src/lib/prisma';

async function addTermsAndDedupe() {
  console.log('➕ Adding terms and removing duplicates...\n');
  console.log('=' .repeat(60));

  const terms = [
    'Assets',
    'Capital',
    'Residence',
    'Portfolio',
    'Investments'
  ];

  console.log(`\n📝 Adding ${terms.length} terms with priority 1:\n`);

  for (const term of terms) {
    await scraperQueue.add(
      'scrape-properties',
      { searchTerm: term },
      { priority: 1 }
    );
    console.log(`  ✅ Added "${term}"`);
  }

  console.log('\n🔍 Now checking for duplicates...\n');

  // Get all pending jobs (waiting + delayed)
  const [waitingJobs, delayedJobs] = await Promise.all([
    scraperQueue.getWaiting(),
    scraperQueue.getDelayed(),
  ]);

  const allPendingJobs = [...waitingJobs, ...delayedJobs];

  console.log(`📊 Queue State:`);
  console.log(`   Waiting: ${waitingJobs.length}`);
  console.log(`   Delayed: ${delayedJobs.length}`);
  console.log(`   Total Pending: ${allPendingJobs.length}\n`);

  // Get completed search terms from database
  const completedTerms = await prisma.scrapeJob.findMany({
    where: { status: 'completed' },
    select: { searchTerm: true },
    distinct: ['searchTerm'],
  });

  const completedTermSet = new Set(completedTerms.map(j => j.searchTerm));

  // Track search terms and their job IDs
  const termMap = new Map<string, Array<{ job: any; priority: number }>>();

  // Build map of search terms to jobs
  for (const job of allPendingJobs) {
    const term = job.data.searchTerm;

    if (!termMap.has(term)) {
      termMap.set(term, []);
    }
    termMap.get(term)!.push({
      job,
      priority: job.opts.priority || 10,
    });
  }

  // Find duplicates within pending jobs
  const duplicateTerms = Array.from(termMap.entries())
    .filter(([_, jobs]) => jobs.length > 1);

  // Find jobs that were already completed
  const alreadyCompletedTerms = Array.from(termMap.entries())
    .filter(([term, _]) => completedTermSet.has(term));

  console.log(`🔍 Analysis:`);
  console.log(`   Unique pending terms: ${termMap.size}`);
  console.log(`   ❌ Terms with duplicate pending jobs: ${duplicateTerms.length}`);
  console.log(`   ✅ Terms already completed: ${alreadyCompletedTerms.length}`);

  let totalToRemove = 0;

  // Count duplicates
  for (const [_, jobs] of duplicateTerms) {
    totalToRemove += jobs.length - 1; // Keep one
  }

  // Count already completed
  for (const [_, jobs] of alreadyCompletedTerms) {
    totalToRemove += jobs.length; // Remove all
  }

  console.log(`   🗑️  Total jobs to remove: ${totalToRemove}\n`);

  if (totalToRemove === 0) {
    console.log('✅ No duplicates or completed terms found!');
  } else {
    // Show what we're removing
    if (duplicateTerms.length > 0) {
      console.log('📝 Duplicate pending jobs:');
      duplicateTerms.forEach(([term, jobs]) => {
        console.log(`   "${term}": ${jobs.length} copies (keeping 1, removing ${jobs.length - 1})`);
      });
      console.log('');
    }

    if (alreadyCompletedTerms.length > 0) {
      console.log('📝 Already completed terms in queue:');
      alreadyCompletedTerms.forEach(([term, jobs]) => {
        console.log(`   "${term}": ${jobs.length} pending (removing all)`);
      });
      console.log('');
    }

    // Remove jobs
    console.log(`🚀 Removing ${totalToRemove} duplicate/completed jobs...`);
    let removed = 0;
    let failed = 0;

    // Remove duplicates (keep highest priority)
    for (const [term, jobs] of duplicateTerms) {
      // Sort by priority (lower number = higher priority)
      jobs.sort((a, b) => a.priority - b.priority);

      // Remove all but the first (highest priority) job
      for (let i = 1; i < jobs.length; i++) {
        try {
          await jobs[i].job.remove();
          removed++;
        } catch (error: any) {
          failed++;
          if (failed <= 3) {
            console.error(`   ❌ Failed to remove job ${jobs[i].job.id}:`, error.message);
          }
        }
      }
    }

    // Remove already completed terms
    for (const [term, jobs] of alreadyCompletedTerms) {
      for (const jobInfo of jobs) {
        try {
          await jobInfo.job.remove();
          removed++;
        } catch (error: any) {
          failed++;
          if (failed <= 3) {
            console.error(`   ❌ Failed to remove job ${jobInfo.job.id}:`, error.message);
          }
        }
      }
    }

    console.log(`\n✅ Cleanup complete!`);
    console.log(`   - Successfully removed: ${removed}`);
    console.log(`   - Failed to remove: ${failed}`);
  }

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

addTermsAndDedupe()
  .then(() => {
    console.log('\n🎉 Terms added and duplicates removed!');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Operation failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
