#!/usr/bin/env npx tsx

import { scraperQueue } from './src/queues/scraper.queue';
import { prisma } from './src/lib/prisma';

async function testQueue() {
  console.log('🧪 Testing Updated Queue with TCAD_API_KEY\n');
  console.log('=' .repeat(60));

  // Refresh token first
  console.log('\n📝 Token status:');
  console.log(`  TCAD_API_KEY present: ${!!process.env.TCAD_API_KEY}`);
  if (process.env.TCAD_API_KEY) {
    console.log(`  Token preview: ${process.env.TCAD_API_KEY.substring(0, 50)}...`);
  }

  // Test search terms - use smaller ones for quick testing
  const testSearchTerms = [
    'Hyde Park',    // Should find ~107 properties
    'Johnson LLC',  // Should find ~38 properties
  ];

  console.log(`\n🚀 Queuing ${testSearchTerms.length} test jobs...\n`);

  const jobIds: string[] = [];

  for (const searchTerm of testSearchTerms) {
    const job = await scraperQueue.add(
      'scrape-properties',
      {
        searchTerm,
        userId: 'test-queue',
        scheduled: false,
      },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 2000 },
      }
    );

    jobIds.push(job.id.toString());
    console.log(`  ✓ Queued: "${searchTerm}" (Job ID: ${job.id})`);
  }

  console.log(`\n⏳ Waiting for jobs to complete...\n`);

  // Monitor job completion
  const checkInterval = 2000;
  const timeout = 120000; // 2 minutes
  const startTime = Date.now();

  while (true) {
    if (Date.now() - startTime > timeout) {
      console.log('⚠️  Timeout reached!');
      break;
    }

    const [waiting, active, completed, failed] = await Promise.all([
      scraperQueue.getWaitingCount(),
      scraperQueue.getActiveCount(),
      scraperQueue.getCompletedCount(),
      scraperQueue.getFailedCount(),
    ]);

    console.log(`  Queue: Waiting=${waiting}, Active=${active}, Completed=${completed}, Failed=${failed}`);

    // Check individual job statuses
    let allDone = true;
    for (const jobId of jobIds) {
      const job = await scraperQueue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        if (state !== 'completed' && state !== 'failed') {
          allDone = false;
        }
      }
    }

    if (allDone) {
      console.log('\n✅ All jobs completed!\n');
      break;
    }

    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  // Print results
  console.log('=' .repeat(60));
  console.log('RESULTS:\n');

  for (const jobId of jobIds) {
    const job = await scraperQueue.getJob(jobId);
    if (!job) {
      console.log(`  ❌ Job ${jobId}: Not found`);
      continue;
    }

    const state = await job.getState();
    const result = job.returnvalue;

    console.log(`  Job ${jobId} (${job.data.searchTerm}):`);
    console.log(`    State: ${state}`);

    if (state === 'completed' && result) {
      console.log(`    ✅ Found ${result.count} properties in ${(result.duration / 1000).toFixed(2)}s`);
    } else if (state === 'failed') {
      console.log(`    ❌ Failed: ${job.failedReason}`);
    }
    console.log();
  }

  // Check database
  const dbCount = await prisma.property.count();
  console.log(`📊 Total properties in database: ${dbCount.toLocaleString()}`);

  console.log('\n✅ Test complete!');
  process.exit(0);
}

testQueue().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
