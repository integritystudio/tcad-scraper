#!/usr/bin/env npx tsx

import { prisma } from './src/lib/prisma';

async function checkResults() {
  const searchTerms = ['Estate', 'Family', 'Trust'];

  const results = await prisma.scrapeJob.findMany({
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
    take: 10,
  });

  console.log('\n📊 RESULTS FOR PRIORITY SEARCH TERMS:\n');
  console.log('=' .repeat(60));

  const byTerm: Record<string, typeof results> = {
    'Estate': [],
    'Family': [],
    'Trust': []
  };

  results.forEach(job => {
    if (byTerm[job.searchTerm]) {
      byTerm[job.searchTerm].push(job);
    }
  });

  let total = 0;
  let idx = 0;

  for (const term of searchTerms) {
    const jobs = byTerm[term];
    if (jobs.length > 0) {
      const latestJob = jobs[0];
      const props = latestJob.resultCount || 0;
      total += props;
      idx++;

      console.log(`${idx}. "${latestJob.searchTerm}"`);
      console.log(`   Status: ${latestJob.status}`);
      console.log(`   Properties: ${props.toLocaleString()}`);
      if (latestJob.completedAt) {
        console.log(`   Completed: ${new Date(latestJob.completedAt).toLocaleTimeString()}`);
      }
      console.log('');
    }
  }

  console.log('=' .repeat(60));
  console.log(`\n🎉 Total Properties: ${total.toLocaleString()}`);
  console.log(`📈 Average per search: ${(total / idx).toFixed(1)}`);

  await prisma.$disconnect();
}

checkResults().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
