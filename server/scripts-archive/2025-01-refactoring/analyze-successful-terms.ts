#!/usr/bin/env npx tsx

import { prisma } from './src/lib/prisma';

async function analyzeSuccessfulTerms() {
  console.log('🔍 Analyzing Most Successful Search Term Types\n');
  console.log('=' .repeat(70));

  // Get all successful jobs (with results)
  const successfulJobs = await prisma.scrapeJob.findMany({
    where: {
      status: 'completed',
      resultCount: { gt: 0 }
    },
    select: {
      searchTerm: true,
      resultCount: true
    },
    orderBy: {
      resultCount: 'desc'
    }
  });

  console.log(`\n📊 Total successful scrapes: ${successfulJobs.length.toLocaleString()}`);

  const totalProperties = successfulJobs.reduce((sum, job) => sum + (job.resultCount || 0), 0);
  console.log(`📊 Total properties found: ${totalProperties.toLocaleString()}`);
  console.log(`📊 Average per successful search: ${(totalProperties / successfulJobs.length).toFixed(1)}`);

  // Categorize search terms
  const categories = {
    singleLastName: [] as typeof successfulJobs,
    fullName: [] as typeof successfulJobs,
    businessWithSuffix: [] as typeof successfulJobs,
    businessGeneric: [] as typeof successfulJobs,
    streetAddress: [] as typeof successfulJobs,
    streetName: [] as typeof successfulJobs,
    shortCode: [] as typeof successfulJobs,
    other: [] as typeof successfulJobs
  };

  const businessSuffixes = /\b(LLC|Inc|Corp|Company|Trust|Foundation|Partners|Group|Properties|Ventures|Capital|Holdings|Development|Estate|Assets|Portfolio|LTD|Enterprises|Management|Realty|Investment)\b/i;
  const streetSuffixes = /\b(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Circle|Cir|Way|Place|Pl|Parkway|Loop|Trail|Path|Highway|Hwy)\b/i;
  const commonStreets = /\b(Lamar|Congress|Riverside|Guadalupe|Airport|Burnet|Mopac|Anderson|MLK|Oltorf|Barton|Springs|Research|Metric|Wells Branch|Far West|Dean Keeton|Speedway|Red River|Manchaca|William Cannon|Slaughter|Parmer|Braker|Rundberg|Koenig|North Loop|South Congress|East Riverside|West Anderson|Capital of Texas|Loop 360|IH 35|Enfield|Exposition|Westlake|Windsor|Oak|Rainey|Cameron|Duval|San Jacinto|Shoal Creek|Cesar Chavez|Main|Howard|McNeil|Dessau|Jollyville|Spicewood|Bee Cave|Balcones|Mueller|Cherrywood|Sabine|Nueces|Trinity|Rio Grande|Manor|Springdale)\b/i;

  successfulJobs.forEach(job => {
    const term = job.searchTerm;
    const words = term.split(/\s+/);

    // Check for street address (starts with number + street name)
    if (/^\d+\s+/.test(term) && (streetSuffixes.test(term) || commonStreets.test(term))) {
      categories.streetAddress.push(job);
    }
    // Check for street name only
    else if (streetSuffixes.test(term) || commonStreets.test(term)) {
      categories.streetName.push(job);
    }
    // Check for business with suffix
    else if (businessSuffixes.test(term)) {
      categories.businessWithSuffix.push(job);
    }
    // Check for full name (2-3 words, mostly letters, capitalized)
    else if (words.length >= 2 && words.length <= 3 && /^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(term)) {
      categories.fullName.push(job);
    }
    // Check for single last name (one word, mostly letters, capitalized)
    else if (words.length === 1 && /^[A-Z][a-z]+$/.test(term) && term.length > 3) {
      categories.singleLastName.push(job);
    }
    // Check for short codes (alphanumeric, short)
    else if (term.length <= 6 && /[A-Z0-9]/.test(term)) {
      categories.shortCode.push(job);
    }
    // Everything else
    else {
      categories.other.push(job);
    }
  });

  // Calculate statistics for each category
  const stats = Object.entries(categories).map(([name, jobs]) => {
    const total = jobs.reduce((sum, job) => sum + (job.resultCount || 0), 0);
    const avg = jobs.length > 0 ? total / jobs.length : 0;
    const max = jobs.length > 0 ? Math.max(...jobs.map(j => j.resultCount || 0)) : 0;
    return {
      name,
      count: jobs.length,
      totalProperties: total,
      avgProperties: avg,
      maxProperties: max,
      percentage: (jobs.length / successfulJobs.length) * 100
    };
  }).sort((a, b) => b.totalProperties - a.totalProperties);

  console.log('\n📋 Search Term Categories (by total properties found):\n');
  stats.forEach((stat, idx) => {
    const categoryName = stat.name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();

    console.log(`${idx + 1}. ${categoryName}`);
    console.log(`   Searches: ${stat.count.toLocaleString()} (${stat.percentage.toFixed(1)}%)`);
    console.log(`   Properties: ${stat.totalProperties.toLocaleString()}`);
    console.log(`   Avg per search: ${stat.avgProperties.toFixed(1)}`);
    console.log(`   Max in single search: ${stat.maxProperties}`);
    console.log('');
  });

  // Show top examples from each category
  console.log('=' .repeat(70));
  console.log('\n🏆 TOP PERFORMERS BY CATEGORY:\n');

  for (const [categoryName, jobs] of Object.entries(categories)) {
    if (jobs.length === 0) continue;

    const displayName = categoryName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();

    const topJobs = jobs.sort((a, b) => (b.resultCount || 0) - (a.resultCount || 0)).slice(0, 5);

    console.log(`${displayName}:`);
    topJobs.forEach((job, idx) => {
      console.log(`  ${idx + 1}. "${job.searchTerm}": ${job.resultCount} properties`);
    });
    console.log('');
  }

  // Success rate comparison
  console.log('=' .repeat(70));
  console.log('\n💡 KEY INSIGHTS:\n');

  const insights = stats.filter(s => s.count > 10).slice(0, 3);
  console.log('Most productive search types:');
  insights.forEach((stat, idx) => {
    const categoryName = stat.name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
    console.log(`  ${idx + 1}. ${categoryName}: ${stat.avgProperties.toFixed(1)} properties/search on average`);
  });

  console.log('\n' + '=' .repeat(70));

  await prisma.$disconnect();
}

analyzeSuccessfulTerms()
  .then(() => {
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Analysis failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
