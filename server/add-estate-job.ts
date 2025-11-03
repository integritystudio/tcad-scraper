#!/usr/bin/env npx tsx

import { scraperQueue } from './src/queues/scraper.queue';
import { prisma } from './src/lib/prisma';

async function addEstateJob() {
  console.log('➕ Adding "Estate" to front of queue...\n');

  await scraperQueue.add(
    'scrape-properties',
    { searchTerm: 'Estate' },
    { priority: 1 }
  );

  console.log('✅ Added "Estate" with priority 1 (front of queue)');

  // Show queue status
  const waiting = await scraperQueue.getWaitingCount();
  const active = await scraperQueue.getActiveCount();

  console.log(`\n📊 Queue Status:`);
  console.log(`   Waiting: ${waiting}`);
  console.log(`   Active: ${active}`);

  await prisma.$disconnect();
}

addEstateJob().then(() => process.exit(0)).catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});
