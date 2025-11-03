#!/usr/bin/env npx tsx

import { prisma } from './src/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';

interface ZeroResultPattern {
  pattern: string;
  count: number;
  examples: string[];
  shouldAvoid: boolean;
  reason: string;
}

async function monitorAndOptimize() {
  console.log('🔍 ZERO-RESULT MONITOR & OPTIMIZER\n');
  console.log('='.repeat(60));

  // Get recent zero-result jobs (last 500)
  const recentZeroResults = await prisma.scrapeJob.findMany({
    where: {
      status: 'completed',
      resultCount: 0
    },
    select: {
      searchTerm: true,
      completedAt: true,
    },
    orderBy: { completedAt: 'desc' },
    take: 500
  });

  const totalZeroResults = recentZeroResults.length;
  console.log(`📊 Recent zero-result jobs: ${totalZeroResults}\n`);

  if (totalZeroResults < 40) {
    console.log(`✅ Zero results (${totalZeroResults}) below threshold (40)`);
    console.log('   No optimization needed at this time.\n');
    console.log('='.repeat(60));
    return {
      needsOptimization: false,
      zeroResultCount: totalZeroResults
    };
  }

  console.log(`⚠️  Zero results (${totalZeroResults}) ABOVE threshold (40)`);
  console.log('   Analyzing patterns for optimization...\n');

  // Analyze patterns in zero-result terms
  const patterns: { [key: string]: ZeroResultPattern } = {
    singleNumbers: {
      pattern: 'Single digit numbers (0-9)',
      count: 0,
      examples: [],
      shouldAvoid: true,
      reason: 'Too generic, rarely match property records'
    },
    shortNumbers: {
      pattern: 'Short numbers (10-99)',
      count: 0,
      examples: [],
      shouldAvoid: true,
      reason: 'Not specific enough for property searches'
    },
    mediumNumbers: {
      pattern: 'Medium numbers (100-999)',
      count: 0,
      examples: [],
      shouldAvoid: true,
      reason: 'Better to use full addresses'
    },
    longNumbers: {
      pattern: 'Long numbers (1000-9999)',
      count: 0,
      examples: [],
      shouldAvoid: false,
      reason: 'Could be valid street numbers'
    },
    alphanumeric2: {
      pattern: '2-character alphanumeric (AB, 1A, etc)',
      count: 0,
      examples: [],
      shouldAvoid: true,
      reason: 'Too short to be meaningful'
    },
    alphanumeric3: {
      pattern: '3-character alphanumeric (A1B, 12C, etc)',
      count: 0,
      examples: [],
      shouldAvoid: true,
      reason: 'Usually not valid property identifiers'
    },
    alphanumeric4: {
      pattern: '4-character alphanumeric (AB12, X1Y2, etc)',
      count: 0,
      examples: [],
      shouldAvoid: true,
      reason: 'Rarely match property records'
    },
    veryShortWords: {
      pattern: 'Very short words (1-2 letters)',
      count: 0,
      examples: [],
      shouldAvoid: true,
      reason: 'Too generic'
    },
    businessWithCommonWord: {
      pattern: 'Business name with common word (X Properties, X Trust, etc)',
      count: 0,
      examples: [],
      shouldAvoid: false,
      reason: 'Can be valid if specific enough'
    },
    fullNames: {
      pattern: 'Full names (First Last)',
      count: 0,
      examples: [],
      shouldAvoid: true,
      reason: 'Last name only performs better'
    },
    streetAddresses: {
      pattern: 'Street addresses (123 Main)',
      count: 0,
      examples: [],
      shouldAvoid: true,
      reason: 'Too specific, usually zero results'
    },
    randomCombos: {
      pattern: 'Random letter combinations',
      count: 0,
      examples: [],
      shouldAvoid: true,
      reason: 'Not real words or names'
    }
  };

  // Classify each zero-result term
  for (const job of recentZeroResults) {
    const term = job.searchTerm;

    // Single digit numbers
    if (/^\d$/.test(term)) {
      patterns.singleNumbers.count++;
      if (patterns.singleNumbers.examples.length < 5) {
        patterns.singleNumbers.examples.push(term);
      }
    }
    // Short numbers (10-99)
    else if (/^\d{2}$/.test(term)) {
      patterns.shortNumbers.count++;
      if (patterns.shortNumbers.examples.length < 5) {
        patterns.shortNumbers.examples.push(term);
      }
    }
    // Medium numbers (100-999)
    else if (/^\d{3}$/.test(term)) {
      patterns.mediumNumbers.count++;
      if (patterns.mediumNumbers.examples.length < 5) {
        patterns.mediumNumbers.examples.push(term);
      }
    }
    // Long numbers (1000-9999)
    else if (/^\d{4,5}$/.test(term)) {
      patterns.longNumbers.count++;
      if (patterns.longNumbers.examples.length < 5) {
        patterns.longNumbers.examples.push(term);
      }
    }
    // 2-char alphanumeric
    else if (/^[A-Z0-9]{2}$/.test(term) && /\d/.test(term) && /[A-Z]/.test(term)) {
      patterns.alphanumeric2.count++;
      if (patterns.alphanumeric2.examples.length < 5) {
        patterns.alphanumeric2.examples.push(term);
      }
    }
    // 3-char alphanumeric
    else if (/^[A-Z0-9]{3}$/.test(term) && /\d/.test(term) && /[A-Z]/.test(term)) {
      patterns.alphanumeric3.count++;
      if (patterns.alphanumeric3.examples.length < 5) {
        patterns.alphanumeric3.examples.push(term);
      }
    }
    // 4-char alphanumeric
    else if (/^[A-Z0-9]{4}$/.test(term) && /\d/.test(term) && /[A-Z]/.test(term)) {
      patterns.alphanumeric4.count++;
      if (patterns.alphanumeric4.examples.length < 5) {
        patterns.alphanumeric4.examples.push(term);
      }
    }
    // Very short words
    else if (/^[A-Z]{1,2}$/.test(term)) {
      patterns.veryShortWords.count++;
      if (patterns.veryShortWords.examples.length < 5) {
        patterns.veryShortWords.examples.push(term);
      }
    }
    // Full names (has space and multiple words)
    else if (/^[A-Z][a-z]+ [A-Z][a-z]+/.test(term) && !/ (LLC|Inc|Corp|LTD|Properties|Trust|Company)/.test(term)) {
      patterns.fullNames.count++;
      if (patterns.fullNames.examples.length < 5) {
        patterns.fullNames.examples.push(term);
      }
    }
    // Street addresses (starts with numbers)
    else if (/^\d+ [A-Z]/.test(term)) {
      patterns.streetAddresses.count++;
      if (patterns.streetAddresses.examples.length < 5) {
        patterns.streetAddresses.examples.push(term);
      }
    }
    // Random combos (short all-caps words that don't look like real words)
    else if (/^[A-Z]{3,5}$/.test(term) && !/[AEIOU]/.test(term)) {
      patterns.randomCombos.count++;
      if (patterns.randomCombos.examples.length < 5) {
        patterns.randomCombos.examples.push(term);
      }
    }
  }

  // Find patterns that should be avoided
  const problematicPatterns = Object.entries(patterns)
    .filter(([_, p]) => p.shouldAvoid && p.count > 0)
    .sort((a, b) => b[1].count - a[1].count);

  console.log('📋 Zero-Result Patterns Found:\n');

  for (const [key, pattern] of problematicPatterns) {
    console.log(`   🔴 ${pattern.pattern}`);
    console.log(`      Count: ${pattern.count} (${(pattern.count / totalZeroResults * 100).toFixed(1)}%)`);
    console.log(`      Reason: ${pattern.reason}`);
    if (pattern.examples.length > 0) {
      console.log(`      Examples: ${pattern.examples.join(', ')}`);
    }
    console.log('');
  }

  // Generate recommendations
  console.log('💡 RECOMMENDATIONS:\n');

  const recommendations: string[] = [];

  if (patterns.singleNumbers.count + patterns.shortNumbers.count + patterns.mediumNumbers.count > 10) {
    recommendations.push('- REMOVE numeric-only search strategies (pure numbers rarely work)');
  }

  if (patterns.alphanumeric2.count + patterns.alphanumeric3.count + patterns.alphanumeric4.count > 15) {
    recommendations.push('- REMOVE or DISABLE short alphanumeric combination generators');
  }

  if (patterns.fullNames.count > 10) {
    recommendations.push('- AVOID full name combinations, use last names only');
  }

  if (patterns.streetAddresses.count > 10) {
    recommendations.push('- AVOID specific street addresses, use street names only');
  }

  if (patterns.veryShortWords.count > 5) {
    recommendations.push('- ADD minimum length filter (3+ characters for words)');
  }

  if (patterns.randomCombos.count > 10) {
    recommendations.push('- IMPROVE word generation to use real names/places only');
  }

  if (recommendations.length === 0) {
    console.log('   ✅ No major pattern issues detected\n');
    console.log('   Current strategies appear reasonable.\n');
  } else {
    recommendations.forEach(rec => console.log(`   ${rec}`));
    console.log('');
  }

  // Save analysis report
  const reportDir = path.join(__dirname, 'data');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const report = {
    timestamp: new Date().toISOString(),
    totalZeroResults,
    threshold: 40,
    needsOptimization: true,
    patterns: Object.fromEntries(
      Object.entries(patterns)
        .filter(([_, p]) => p.count > 0)
        .map(([key, p]) => [key, {
          pattern: p.pattern,
          count: p.count,
          percentage: (p.count / totalZeroResults * 100).toFixed(1),
          shouldAvoid: p.shouldAvoid,
          reason: p.reason,
          examples: p.examples
        }])
    ),
    recommendations
  };

  const reportPath = path.join(reportDir, 'zero-result-analysis.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Report saved to: ${reportPath}\n`);

  // Check if continuous-batch-scraper needs updates
  console.log('🔧 Checking continuous-batch-scraper.ts configuration...\n');

  const scraperPath = path.join(__dirname, 'src/scripts/continuous-batch-scraper.ts');
  const scraperContent = fs.readFileSync(scraperPath, 'utf-8');

  const issuesFound: string[] = [];

  // Check if problematic strategies are still active
  if (scraperContent.includes('generateTwoLetterCombo') || scraperContent.includes('generateThreeLetterCombo')) {
    issuesFound.push('❌ Short alphanumeric generators still present');
  }

  if (scraperContent.includes('generateFullName') && !scraperContent.includes('// generateFullName')) {
    issuesFound.push('❌ Full name generator still active');
  }

  if (scraperContent.includes('generateStreetAddress') && !scraperContent.includes('// generateStreetAddress')) {
    issuesFound.push('❌ Street address generator still active');
  }

  if (issuesFound.length > 0) {
    console.log('   Issues found in scraper configuration:');
    issuesFound.forEach(issue => console.log(`   ${issue}`));
    console.log('\n   ⚠️  Manual review recommended!\n');
  } else {
    console.log('   ✅ Scraper configuration looks good\n');
  }

  console.log('='.repeat(60));
  console.log('✨ Analysis complete!\n');

  return report;
}

// Run the monitor
monitorAndOptimize()
  .then(() => {
    console.log('✅ Monitoring complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
