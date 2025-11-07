#!/usr/bin/env npx tsx

import { prisma } from './src/lib/prisma';

async function checkScrapingRate() {
  console.log('⚡ Calculating Current Scraping Rate\n');
  console.log('=' .repeat(60));

  // Get jobs from the last 10 minutes
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);

  // Last 10 minutes
  const last10MinJobs = await prisma.scrapeJob.findMany({
    where: {
      status: 'completed',
      completedAt: { gte: tenMinutesAgo }
    },
    select: {
      searchTerm: true,
      resultCount: true,
      startedAt: true,
      completedAt: true
    },
    orderBy: { completedAt: 'desc' }
  });

  // Last 5 minutes
  const last5MinJobs = await prisma.scrapeJob.findMany({
    where: {
      status: 'completed',
      completedAt: { gte: fiveMinutesAgo }
    },
    select: {
      searchTerm: true,
      resultCount: true,
      startedAt: true,
      completedAt: true
    },
    orderBy: { completedAt: 'desc' }
  });

  // Last 1 minute
  const last1MinJobs = await prisma.scrapeJob.findMany({
    where: {
      status: 'completed',
      completedAt: { gte: oneMinuteAgo }
    },
    select: {
      searchTerm: true,
      resultCount: true,
      startedAt: true,
      completedAt: true
    },
    orderBy: { completedAt: 'desc' }
  });

  // Calculate stats
  const calc = (jobs: typeof last10MinJobs, minutes: number) => {
    const total = jobs.reduce((sum, job) => sum + (job.resultCount || 0), 0);
    const rate = total / minutes;
    return { total, jobs: jobs.length, rate };
  };

  const stats10 = calc(last10MinJobs, 10);
  const stats5 = calc(last5MinJobs, 5);
  const stats1 = calc(last1MinJobs, 1);

  console.log('\n📊 Last 10 Minutes:');
  console.log(`  Jobs completed: ${stats10.jobs}`);
  console.log(`  Properties added: ${stats10.total.toLocaleString()}`);
  console.log(`  Rate: ${stats10.rate.toFixed(1)} properties/minute`);

  console.log('\n📊 Last 5 Minutes:');
  console.log(`  Jobs completed: ${stats5.jobs}`);
  console.log(`  Properties added: ${stats5.total.toLocaleString()}`);
  console.log(`  Rate: ${stats5.rate.toFixed(1)} properties/minute`);

  console.log('\n📊 Last 1 Minute:');
  console.log(`  Jobs completed: ${stats1.jobs}`);
  console.log(`  Properties added: ${stats1.total.toLocaleString()}`);
  console.log(`  Rate: ${stats1.rate.toFixed(1)} properties/minute`);

  // Show recent jobs
  if (last5MinJobs.length > 0) {
    console.log('\n📝 Recent Completions (last 5 min):');
    last5MinJobs.slice(0, 10).forEach((job, idx) => {
      const duration = job.completedAt && job.startedAt
        ? ((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000).toFixed(1)
        : 'N/A';
      const time = job.completedAt ? new Date(job.completedAt).toLocaleTimeString() : 'N/A';
      console.log(`  ${idx + 1}. ${time} - "${job.searchTerm}": ${job.resultCount} props (${duration}s)`);
    });
  }

  // Extrapolate
  const currentRate = stats5.jobs > 0 ? stats5.rate : stats10.rate;
  console.log('\n⏱️  Projections (at current rate):');
  console.log(`  Properties per hour: ${(currentRate * 60).toFixed(0).toLocaleString()}`);
  console.log(`  Properties per day: ${(currentRate * 60 * 24).toFixed(0).toLocaleString()}`);

  // Estimate time to completion
  const waitingCount = 523; // From earlier check
  const avgPropsPerJob = currentRate > 0 ? stats5.total / stats5.jobs : 0;
  const estimatedProps = waitingCount * avgPropsPerJob;
  const estimatedMinutes = estimatedProps / currentRate;

  console.log('\n🎯 Queue Estimates (523 jobs remaining):');
  console.log(`  Avg properties per job: ${avgPropsPerJob.toFixed(0)}`);
  console.log(`  Estimated properties to add: ${estimatedProps.toFixed(0).toLocaleString()}`);
  if (currentRate > 0) {
    console.log(`  Estimated time to complete: ${(estimatedMinutes / 60).toFixed(1)} hours`);
  }

  console.log('\n' + '=' .repeat(60));

  await prisma.$disconnect();
}

checkScrapingRate()
  .then(() => {
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
