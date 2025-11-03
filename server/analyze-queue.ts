#!/usr/bin/env npx tsx

import { prisma } from './src/lib/prisma';
import { scraperQueue } from './src/queues/scraper.queue';

async function analyzeAndOptimizeQueue() {
  console.log('🔍 Analyzing Queue Performance...\n');

  // Get failed jobs
  const failedJobs = await prisma.scrapeJob.findMany({
    where: { status: 'failed' },
    select: { searchTerm: true, error: true },
    orderBy: { id: 'desc' },
    take: 50
  });

  console.log(`❌ Failed Jobs: ${failedJobs.length}`);
  const failedTerms = new Set(failedJobs.map(j => j.searchTerm));
  console.log('Failed search terms:', Array.from(failedTerms).slice(0, 20));

  // Get completed jobs with zero results
  const emptyJobs = await prisma.scrapeJob.findMany({
    where: {
      status: 'completed',
      resultCount: 0
    },
    select: { searchTerm: true },
    orderBy: { id: 'desc' },
    take: 100
  });

  console.log(`\n⚠️  Empty Result Jobs: ${emptyJobs.length}`);
  const emptyTerms = new Set(emptyJobs.map(j => j.searchTerm));
  console.log('Empty result search terms (sample):', Array.from(emptyTerms).slice(0, 20));

  // Get top performing searches
  const topJobs = await prisma.scrapeJob.findMany({
    where: {
      status: 'completed',
      resultCount: { gt: 0 }
    },
    select: { searchTerm: true, resultCount: true },
    orderBy: { resultCount: 'desc' },
    take: 20
  });

  console.log(`\n✅ Top Performing Searches:`);
  topJobs.forEach(j => console.log(`  ${j.searchTerm}: ${j.resultCount} properties`));

  // Combine problematic terms
  const problematicTerms = new Set([...failedTerms, ...emptyTerms]);
  console.log(`\n🎯 Total problematic search terms: ${problematicTerms.size}`);

  // Get waiting jobs
  const waitingJobs = await scraperQueue.getWaiting();
  console.log(`\n⏳ Waiting jobs in queue: ${waitingJobs.length}`);

  // Identify jobs to remove
  const jobsToRemove = waitingJobs.filter(job =>
    problematicTerms.has(job.data.searchTerm)
  );

  console.log(`\n🗑️  Jobs to remove: ${jobsToRemove.length}`);
  console.log('Sample terms to remove:', jobsToRemove.slice(0, 10).map(j => j.data.searchTerm));

  // Count duplicates
  const searchTermCounts = new Map<string, number>();
  waitingJobs.forEach(job => {
    const term = job.data.searchTerm;
    searchTermCounts.set(term, (searchTermCounts.get(term) || 0) + 1);
  });

  const duplicates = Array.from(searchTermCounts.entries())
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1]);

  console.log(`\n📋 Duplicate search terms: ${duplicates.length}`);
  console.log('Top duplicates:', duplicates.slice(0, 10));

  // Ask for confirmation
  console.log('\n⚠️  Actions to take:');
  console.log(`  1. Remove ${jobsToRemove.length} jobs with problematic search terms`);
  console.log(`  2. Keep ${waitingJobs.length - jobsToRemove.length} promising jobs`);
  console.log(`  3. ${duplicates.length} search terms have duplicates that could be deduplicated`);

  return {
    failedTerms: Array.from(failedTerms),
    emptyTerms: Array.from(emptyTerms),
    problematicTerms: Array.from(problematicTerms),
    jobsToRemove: jobsToRemove.map(j => ({ id: j.id, term: j.data.searchTerm })),
    duplicates
  };
}

analyzeAndOptimizeQueue()
  .then(async (result) => {
    console.log('\n✅ Analysis complete!');
    console.log('\nSummary written to analysis results.');
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Analysis failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
