#!/usr/bin/env npx tsx

import { prisma } from './src/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

interface SearchTermMapping {
  [searchTerm: string]: {
    resultCount: number;
    lastScraped: Date;
    status: string;
  };
}

async function buildSearchTermMap() {
  console.log('🗺️  Building Search Term → Results Map\n');
  console.log('='.repeat(60));

  // Get all completed scrape jobs with their results
  const allJobs = await prisma.scrapeJob.findMany({
    where: {
      status: 'completed'
    },
    select: {
      searchTerm: true,
      resultCount: true,
      completedAt: true,
      status: true,
    },
    orderBy: {
      completedAt: 'desc'
    }
  });

  console.log(`📊 Total completed jobs: ${allJobs.length}\n`);

  // Build the map - if multiple jobs for same term, keep the most recent one
  const searchTermMap: SearchTermMapping = {};

  for (const job of allJobs) {
    const term = job.searchTerm;

    // Only add if not already in map (since we're processing most recent first)
    if (!searchTermMap[term]) {
      searchTermMap[term] = {
        resultCount: job.resultCount || 0,
        lastScraped: job.completedAt || new Date(),
        status: job.status
      };
    }
  }

  const uniqueTerms = Object.keys(searchTermMap).length;
  console.log(`✅ Unique search terms: ${uniqueTerms}\n`);

  // Calculate statistics
  const resultCounts = Object.values(searchTermMap).map(v => v.resultCount);
  const totalResults = resultCounts.reduce((sum, count) => sum + count, 0);
  const avgResults = totalResults / uniqueTerms;
  const maxResults = Math.max(...resultCounts);
  const minResults = Math.min(...resultCounts);

  const zeroResults = resultCounts.filter(c => c === 0).length;
  const lowResults = resultCounts.filter(c => c > 0 && c < 50).length;
  const mediumResults = resultCounts.filter(c => c >= 50 && c < 200).length;
  const highResults = resultCounts.filter(c => c >= 200 && c < 1000).length;
  const veryHighResults = resultCounts.filter(c => c >= 1000).length;

  console.log('📈 Statistics:');
  console.log(`   Total properties found: ${totalResults.toLocaleString()}`);
  console.log(`   Average per term: ${avgResults.toFixed(1)}`);
  console.log(`   Max results: ${maxResults.toLocaleString()}`);
  console.log(`   Min results: ${minResults.toLocaleString()}\n`);

  console.log('📊 Distribution:');
  console.log(`   Zero results (0): ${zeroResults} (${(zeroResults/uniqueTerms*100).toFixed(1)}%)`);
  console.log(`   Low (1-49): ${lowResults} (${(lowResults/uniqueTerms*100).toFixed(1)}%)`);
  console.log(`   Medium (50-199): ${mediumResults} (${(mediumResults/uniqueTerms*100).toFixed(1)}%)`);
  console.log(`   High (200-999): ${highResults} (${(highResults/uniqueTerms*100).toFixed(1)}%)`);
  console.log(`   Very High (1000+): ${veryHighResults} (${(veryHighResults/uniqueTerms*100).toFixed(1)}%)\n`);

  // Find top performing terms
  const sortedTerms = Object.entries(searchTermMap)
    .sort(([, a], [, b]) => b.resultCount - a.resultCount);

  console.log('🏆 Top 20 Search Terms:\n');
  sortedTerms.slice(0, 20).forEach(([term, data], idx) => {
    console.log(`   ${idx + 1}. "${term}": ${data.resultCount.toLocaleString()} properties`);
  });

  console.log('\n💾 Saving map to files...\n');

  // Save full map as JSON
  const outputDir = path.join(__dirname, 'data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const jsonPath = path.join(outputDir, 'search-term-map.json');
  fs.writeFileSync(jsonPath, JSON.stringify(searchTermMap, null, 2));
  console.log(`   ✅ Full map saved to: ${jsonPath}`);

  // Save sorted list (high to low) as CSV
  const csvPath = path.join(outputDir, 'search-term-results.csv');
  const csvContent = [
    'SearchTerm,ResultCount,LastScraped,Status',
    ...sortedTerms.map(([term, data]) =>
      `"${term}",${data.resultCount},${data.lastScraped.toISOString()},${data.status}`
    )
  ].join('\n');
  fs.writeFileSync(csvPath, csvContent);
  console.log(`   ✅ Sorted CSV saved to: ${csvPath}`);

  // Save high-performers only (>= 100 results)
  const highPerformers = Object.fromEntries(
    sortedTerms.filter(([, data]) => data.resultCount >= 100)
  );
  const highPerfPath = path.join(outputDir, 'high-performing-terms.json');
  fs.writeFileSync(highPerfPath, JSON.stringify(highPerformers, null, 2));
  console.log(`   ✅ High performers (100+) saved to: ${highPerfPath}`);
  console.log(`      (${Object.keys(highPerformers).length} terms)\n`);

  // Save zero-result terms for analysis
  const zeroResultTerms = sortedTerms
    .filter(([, data]) => data.resultCount === 0)
    .map(([term]) => term);
  const zeroPath = path.join(outputDir, 'zero-result-terms.json');
  fs.writeFileSync(zeroPath, JSON.stringify(zeroResultTerms, null, 2));
  console.log(`   ✅ Zero-result terms saved to: ${zeroPath}`);
  console.log(`      (${zeroResultTerms.length} terms)\n`);

  console.log('='.repeat(60));
  console.log('✨ Search term map built successfully!\n');

  // Return summary for programmatic use
  return {
    totalJobs: allJobs.length,
    uniqueTerms,
    totalResults,
    avgResults,
    distribution: {
      zero: zeroResults,
      low: lowResults,
      medium: mediumResults,
      high: highResults,
      veryHigh: veryHighResults
    },
    topTerms: sortedTerms.slice(0, 10).map(([term, data]) => ({
      term,
      count: data.resultCount
    }))
  };
}

buildSearchTermMap()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
