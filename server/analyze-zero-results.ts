#!/usr/bin/env npx tsx

import { prisma } from './src/lib/prisma';

async function analyzeZeroResults() {
  console.log('🔍 Analyzing jobs with zero results...\n');
  console.log('=' .repeat(60));

  const zeroResultJobs = await prisma.scrapeJob.findMany({
    where: {
      status: 'completed',
      resultCount: 0
    },
    select: {
      searchTerm: true,
      resultCount: true,
    },
    orderBy: { id: 'desc' },
    take: 200
  });

  console.log(`\nFound ${zeroResultJobs.length} recent jobs with 0 results:\n`);

  // Analyze patterns
  const patterns = {
    shortCodes: [] as string[],
    numbers: [] as string[],
    twoLetters: [] as string[],
    threeLetters: [] as string[],
    fourLetters: [] as string[],
    alphanumeric: [] as string[],
    other: [] as string[]
  };

  zeroResultJobs.forEach(job => {
    const term = job.searchTerm;

    if (/^\d+$/.test(term)) {
      patterns.numbers.push(term);
    } else if (/^[A-Z]{2}$/.test(term)) {
      patterns.twoLetters.push(term);
    } else if (/^[A-Z]{3}$/.test(term)) {
      patterns.threeLetters.push(term);
    } else if (/^[A-Z]{4}$/.test(term)) {
      patterns.fourLetters.push(term);
    } else if (/^[A-Z0-9]{3,4}$/.test(term)) {
      patterns.alphanumeric.push(term);
    } else {
      patterns.other.push(term);
    }
  });

  console.log('📊 Pattern Analysis:\n');

  console.log(`  Pure numbers: ${patterns.numbers.length}`);
  if (patterns.numbers.length > 0) {
    console.log(`    Examples: ${patterns.numbers.slice(0, 10).join(', ')}`);
  }

  console.log(`\n  Two-letter codes: ${patterns.twoLetters.length}`);
  if (patterns.twoLetters.length > 0) {
    console.log(`    Examples: ${patterns.twoLetters.slice(0, 10).join(', ')}`);
  }

  console.log(`\n  Three-letter codes: ${patterns.threeLetters.length}`);
  if (patterns.threeLetters.length > 0) {
    console.log(`    Examples: ${patterns.threeLetters.slice(0, 10).join(', ')}`);
  }

  console.log(`\n  Four-letter codes: ${patterns.fourLetters.length}`);
  if (patterns.fourLetters.length > 0) {
    console.log(`    Examples: ${patterns.fourLetters.slice(0, 10).join(', ')}`);
  }

  console.log(`\n  Alphanumeric codes (3-4 chars): ${patterns.alphanumeric.length}`);
  if (patterns.alphanumeric.length > 0) {
    console.log(`    Examples: ${patterns.alphanumeric.slice(0, 10).join(', ')}`);
  }

  console.log(`\n  Other patterns: ${patterns.other.length}`);
  if (patterns.other.length > 0) {
    console.log(`    Examples: ${patterns.other.slice(0, 10).join(', ')}`);
  }

  // Calculate success rate for different patterns
  console.log('\n\n📈 Success Rate Analysis:\n');

  const totalJobs = await prisma.scrapeJob.count({
    where: { status: 'completed' }
  });

  const successfulJobs = await prisma.scrapeJob.count({
    where: {
      status: 'completed',
      resultCount: { gt: 0 }
    }
  });

  console.log(`  Total completed jobs: ${totalJobs}`);
  console.log(`  Successful (>0 results): ${successfulJobs}`);
  console.log(`  Zero results: ${totalJobs - successfulJobs}`);
  console.log(`  Success rate: ${((successfulJobs / totalJobs) * 100).toFixed(1)}%`);

  // Get stats on successful searches
  const successfulSearches = await prisma.scrapeJob.findMany({
    where: {
      status: 'completed',
      resultCount: { gt: 0 }
    },
    select: {
      searchTerm: true,
      resultCount: true,
    },
    orderBy: { resultCount: 'desc' },
    take: 20
  });

  console.log(`\n\n✅ Top 20 successful searches:\n`);
  successfulSearches.forEach((job, idx) => {
    console.log(`  ${idx + 1}. "${job.searchTerm}": ${job.resultCount?.toLocaleString()} properties`);
  });

  console.log('\n' + '=' .repeat(60));

  await prisma.$disconnect();
}

analyzeZeroResults()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
