#!/usr/bin/env npx tsx

import { prisma } from './src/lib/prisma';

async function checkResults() {
  const searchTerms = ['Estate', 'Family', 'Trust'];

  const results = await prisma.scrapeJob.findMany({
    where: {
      searchTerm: { in: searchTerms },
      status: 'completed',
      resultCount: { gt: 0 }
    },
    select: {
      searchTerm: true,
      status: true,
      resultCount: true,
      completedAt: true,
    },
    orderBy: { id: 'desc' },
    take: 10,
  });

  console.log('\n📊 SUCCESSFUL RESULTS FOR: Estate, Family, Trust\n');
  console.log('=' .repeat(60));

  if (results.length === 0) {
    console.log('❌ No successful jobs found yet');
   console.log('\nNote: Jobs may still be processing or failed due to "Unexpected end of JSON" errors');
    console.log('This error occurs when the API response is too large (6000+ properties).');
  } else {
    let total = 0;
    results.forEach((job, idx) => {
      const props = job.resultCount || 0;
      total += props;
      console.log(`${idx + 1}. "${job.searchTerm}"`);
      console.log(`   Status: ${job.status}`);
      console.log(`   Properties: ${props.toLocaleString()}`);
      if (job.completedAt) {
        console.log(`   Completed: ${new Date(job.completedAt).toLocaleTimeString()}`);
      }
      console.log('');
    });

    console.log('=' .repeat(60));
    console.log(`\n🎉 Total Properties: ${total.toLocaleString()}`);
    console.log(`📈 Average per search: ${(total / results.length).toFixed(1)}`);
  }

  await prisma.$disconnect();
}

checkResults().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
