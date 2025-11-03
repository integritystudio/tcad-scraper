#!/usr/bin/env npx tsx

import { scraperQueue } from './src/queues/scraper.queue';
import { prisma } from './src/lib/prisma';

async function addBusinessTerms() {
  console.log('➕ Adding business terms to front of queue...\n');

  const terms = [
    'Foundation',
    'Investments',
    'Realty',
    'Assets',
    'Management',  // Fixed spelling from "Mangement"
    'Capital',
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

addBusinessTerms().then(() => process.exit(0)).catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});
