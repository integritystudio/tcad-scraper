#!/usr/bin/env npx tsx

import { scraperQueue } from './src/queues/scraper.queue';
import { prisma } from './src/lib/prisma';

async function addPriorityJobs() {
  console.log('🎯 Adding High-Priority Test Jobs\n');
  console.log('=' .repeat(60));

  const searchTerms = ['Estate', 'Family', 'Trust'];

  for (const searchTerm of searchTerms) {
    console.log(`\n📝 Adding "${searchTerm}" to head of queue...`);

    await scraperQueue.add(
      'scrape-properties',
      {
        searchTerm,
        userId: 'priority-test',
        scheduled: false,
      },
      {
        priority: 1, // Highest priority - goes to head of queue
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    );

    console.log(`✅ Added "${searchTerm}" with priority 1 (head of queue)`);
  }

  // Show queue status
  const [waiting, active] = await Promise.all([
    scraperQueue.getWaitingCount(),
    scraperQueue.getActiveCount(),
  ]);

  console.log(`\n📊 Queue Status:`);
  console.log(`  Waiting: ${waiting}`);
  console.log(`  Active: ${active}`);

  console.log('\n⏳ Waiting for jobs to complete...');
  console.log('Monitoring results (will check every 5 seconds for up to 2 minutes)...\n');

  // Monitor for completion
  let attempts = 0;
  const maxAttempts = 24; // 2 minutes (24 * 5 seconds)

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    attempts++;

    // Check if jobs completed
    const results = await prisma.scrapeJob.findMany({
      where: {
        searchTerm: { in: searchTerms },
        status: 'completed',
      },
      select: {
        searchTerm: true,
        resultCount: true,
        completedAt: true,
      },
      orderBy: { completedAt: 'desc' },
      take: 3,
    });

    if (results.length === 3) {
      console.log('✅ All jobs completed!\n');
      console.log('=' .repeat(60));
      console.log('📊 RESULTS:\n');

      let total = 0;
      results.forEach((job, idx) => {
        const props = job.resultCount || 0;
        total += props;
        console.log(`${idx + 1}. "${job.searchTerm}"`);
        console.log(`   Properties: ${props.toLocaleString()}`);
        console.log(`   Completed: ${job.completedAt ? new Date(job.completedAt).toLocaleTimeString() : 'N/A'}`);
        console.log('');
      });

      console.log('=' .repeat(60));
      console.log(`\n🎉 Total Properties: ${total.toLocaleString()}`);
      console.log(`📈 Average per search: ${(total / 3).toFixed(1)}`);

      break;
    } else if (results.length > 0) {
      console.log(`⏳ ${results.length}/3 jobs completed so far...`);
      results.forEach(job => {
        console.log(`   ✅ "${job.searchTerm}": ${job.resultCount} properties`);
      });
    } else {
      console.log(`⏳ Attempt ${attempts}/${maxAttempts} - still processing...`);
    }
  }

  if (attempts >= maxAttempts) {
    console.log('\n⚠️  Timeout reached. Checking what we have so far...\n');

    const finalResults = await prisma.scrapeJob.findMany({
      where: {
        searchTerm: { in: searchTerms },
      },
      select: {
        searchTerm: true,
        status: true,
        resultCount: true,
        completedAt: true,
      },
      orderBy: { id: 'desc' },
      take: 3,
    });

    console.log('Current status:');
    finalResults.forEach(job => {
      console.log(`  "${job.searchTerm}": ${job.status} (${job.resultCount || 0} properties)`);
    });
  }

  await prisma.$disconnect();
}

addPriorityJobs()
  .then(() => {
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
