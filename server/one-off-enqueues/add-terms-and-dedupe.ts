#!/usr/bin/env npx tsx

import { scraperQueue } from '../src/queues/scraper.queue';
import { prisma } from '../src/lib/prisma';
import { removeDuplicatesFromQueue } from '../src/utils/deduplication';

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

  console.log('');

  // Use shared deduplication utility
  await removeDuplicatesFromQueue({ verbose: true, showProgress: false });

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
