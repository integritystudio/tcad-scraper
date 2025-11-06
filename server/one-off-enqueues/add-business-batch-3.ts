#!/usr/bin/env npx tsx

import { scraperQueue } from '../src/queues/scraper.queue';
import { prisma } from '../src/lib/prisma';

async function addBusinessBatch3() {
  console.log('➕ Adding business batch 3 to front of queue...\n');

  const terms = [
    'Investments',
    'Holdings',
    'Properties',
    'Ventures',
    'Equity',
    'Inc.',
    'Group',
    'Partners'
  ];

  console.log(`Adding ${terms.length} terms with priority 1:\n`);

  for (const term of terms) {
    await scraperQueue.add(
      'scrape-properties',
      { searchTerm: term },
      { priority: 1 }
    );
    console.log(`  ✅ Added "${term}"`);
  }

  // Show queue status
  const waiting = await scraperQueue.getWaitingCount();
  const active = await scraperQueue.getActiveCount();

  console.log(`\n📊 Queue Status:`);
  console.log(`   Waiting: ${waiting}`);
  console.log(`   Active: ${active}`);

  await prisma.$disconnect();
}

addBusinessBatch3().then(() => process.exit(0)).catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});
