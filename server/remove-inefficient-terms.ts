#!/usr/bin/env npx tsx

import { scraperQueue } from './src/queues/scraper.queue';
import { prisma } from './src/lib/prisma';

async function removeInefficientTerms() {
  console.log('🧹 Removing Inefficient Search Terms from Queue\n');
  console.log('=' .repeat(70));

  // Define patterns for categorization
  const businessSuffixes = /\b(LLC|Inc|Corp|Company|Trust|Foundation|Partners|Group|Properties|Ventures|Capital|Holdings|Development|Estate|Assets|Portfolio|LTD|Enterprises|Management|Realty|Investment)\b/i;
  const streetSuffixes = /\b(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Circle|Cir|Way|Place|Pl|Parkway|Loop|Trail|Path|Highway|Hwy)\b/i;
  const commonStreets = /\b(Lamar|Congress|Riverside|Guadalupe|Airport|Burnet|Mopac|Anderson|MLK|Oltorf|Barton|Springs|Research|Metric|Wells Branch|Far West|Dean Keeton|Speedway|Red River|Manchaca|William Cannon|Slaughter|Parmer|Braker|Rundberg|Koenig|North Loop|South Congress|East Riverside|West Anderson|Capital of Texas|Loop 360|IH 35|Enfield|Exposition|Westlake|Windsor|Oak|Rainey|Cameron|Duval|San Jacinto|Shoal Creek|Cesar Chavez|Main|Howard|McNeil|Dessau|Jollyville|Spicewood|Bee Cave|Balcones|Mueller|Cherrywood|Sabine|Nueces|Trinity|Rio Grande|Manor|Springdale)\b/i;

  // Get all waiting jobs
  const waitingJobs = await scraperQueue.getWaiting();
  console.log(`⏳ Current waiting jobs: ${waitingJobs.length}`);

  // Categorize jobs
  const inefficientJobs: typeof waitingJobs = [];
  const efficientJobs: typeof waitingJobs = [];

  const categories = {
    singleLastName: 0,
    fullName: 0,
    businessWithSuffix: 0,
    streetAddress: 0,
    streetName: 0,
    shortCode: 0,
    other: 0
  };

  waitingJobs.forEach(job => {
    const term = job.data.searchTerm;
    const words = term.split(/\s+/);

    let category = '';
    let isInefficient = false;

    // Check for street address (starts with number + street name) - INEFFICIENT
    if (/^\d+\s+/.test(term) && (streetSuffixes.test(term) || commonStreets.test(term))) {
      category = 'streetAddress';
      isInefficient = true;
      categories.streetAddress++;
    }
    // Check for street name only - EFFICIENT
    else if (streetSuffixes.test(term) || commonStreets.test(term)) {
      category = 'streetName';
      categories.streetName++;
    }
    // Check for business with suffix - EFFICIENT
    else if (businessSuffixes.test(term)) {
      category = 'businessWithSuffix';
      categories.businessWithSuffix++;
    }
    // Check for full name (2-3 words, mostly letters, capitalized) - INEFFICIENT
    else if (words.length >= 2 && words.length <= 3 && /^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(term)) {
      category = 'fullName';
      isInefficient = true;
      categories.fullName++;
    }
    // Check for single last name - EFFICIENT
    else if (words.length === 1 && /^[A-Z][a-z]+$/.test(term) && term.length > 3) {
      category = 'singleLastName';
      categories.singleLastName++;
    }
    // Check for short codes - EFFICIENT
    else if (term.length <= 6 && /[A-Z0-9]/.test(term)) {
      category = 'shortCode';
      categories.shortCode++;
    }
    // Everything else - keep for safety
    else {
      category = 'other';
      categories.other++;
    }

    if (isInefficient) {
      inefficientJobs.push(job);
    } else {
      efficientJobs.push(job);
    }
  });

  console.log('\n📊 Queue Breakdown:\n');
  console.log(`  ✅ Single Last Names: ${categories.singleLastName} (70.3 avg props - BEST)`);
  console.log(`  ✅ Street Names: ${categories.streetName} (24.4 avg props - GREAT)`);
  console.log(`  ✅ Short Codes: ${categories.shortCode} (12.6 avg props - GOOD)`);
  console.log(`  ✅ Business Names: ${categories.businessWithSuffix} (6.7 avg props - OK)`);
  console.log(`  ✅ Other: ${categories.other} (keeping for safety)`);
  console.log(`  ❌ Full Names: ${categories.fullName} (4.4 avg props - INEFFICIENT)`);
  console.log(`  ❌ Street Addresses: ${categories.streetAddress} (2.1 avg props - INEFFICIENT)`);

  console.log(`\n🗑️  Jobs to remove: ${inefficientJobs.length}`);
  console.log(`✅ Efficient jobs to keep: ${efficientJobs.length}`);

  if (inefficientJobs.length > 0) {
    // Show samples
    console.log('\nSample inefficient terms being removed:');
    const fullNameSamples = inefficientJobs.filter(j => {
      const term = j.data.searchTerm;
      const words = term.split(/\s+/);
      return words.length >= 2 && /^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(term);
    }).slice(0, 10);

    const addressSamples = inefficientJobs.filter(j => {
      const term = j.data.searchTerm;
      return /^\d+\s+/.test(term);
    }).slice(0, 10);

    if (fullNameSamples.length > 0) {
      console.log('\n  Full Names (2-3 words):');
      fullNameSamples.forEach(j => console.log(`    "${j.data.searchTerm}"`));
    }

    if (addressSamples.length > 0) {
      console.log('\n  Street Addresses (with numbers):');
      addressSamples.forEach(j => console.log(`    "${j.data.searchTerm}"`));
    }

    // Remove the jobs
    console.log(`\n🚀 Removing ${inefficientJobs.length} inefficient jobs...`);
    let removed = 0;
    let failed = 0;

    for (const job of inefficientJobs) {
      try {
        await job.remove();
        removed++;
        if (removed % 20 === 0) {
          process.stdout.write(`\r  Progress: ${removed}/${inefficientJobs.length} (${((removed/inefficientJobs.length)*100).toFixed(1)}%)`);
        }
      } catch (error) {
        failed++;
        if (failed <= 3) {
          console.error(`\n  ❌ Failed to remove job ${job.id}:`, error.message);
        }
      }
    }

    console.log(`\n\n✅ Removal complete!`);
    console.log(`  - Successfully removed: ${removed}`);
    console.log(`  - Failed to remove: ${failed}`);
  } else {
    console.log('\n✅ No inefficient jobs found!');
  }

  // Get updated queue stats
  const [waiting, active, completed, failedCount] = await Promise.all([
    scraperQueue.getWaitingCount(),
    scraperQueue.getActiveCount(),
    scraperQueue.getCompletedCount(),
    scraperQueue.getFailedCount(),
  ]);

  console.log(`\n📊 Final Queue Status:`);
  console.log(`  - Waiting: ${waiting}`);
  console.log(`  - Active: ${active}`);
  console.log(`  - Completed: ${completed}`);
  console.log(`  - Failed: ${failedCount}`);

  // Show remaining efficient jobs
  const remainingJobs = await scraperQueue.getWaiting(0, 20);
  if (remainingJobs.length > 0) {
    console.log(`\n📝 Sample of remaining HIGH-EFFICIENCY search terms:`);
    remainingJobs.forEach((job, idx) => {
      console.log(`  ${idx + 1}. "${job.data.searchTerm}"`);
    });
  }

  console.log('\n' + '=' .repeat(70));

  await prisma.$disconnect();
}

removeInefficientTerms()
  .then(() => {
    console.log('\n🎉 Queue optimized for maximum efficiency!');
    console.log('   Only high-performing search term types remain.');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Optimization failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
