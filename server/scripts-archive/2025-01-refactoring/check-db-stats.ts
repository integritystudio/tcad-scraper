#!/usr/bin/env npx tsx

import { prisma } from './src/lib/prisma';

async function checkDatabaseStats() {
  console.log('📊 Database Statistics\n');
  console.log('=' .repeat(60));

  // Count total properties
  const totalProperties = await prisma.property.count();
  console.log(`\n🏠 Total Properties: ${totalProperties.toLocaleString()}`);

  // Count scrape jobs by status
  const jobStats = await prisma.scrapeJob.groupBy({
    by: ['status'],
    _count: {
      _all: true
    },
    _sum: {
      resultCount: true
    }
  });

  console.log('\n📋 Scrape Jobs:');
  let totalJobs = 0;
  let totalScraped = 0;

  jobStats.forEach(stat => {
    totalJobs += stat._count._all;
    totalScraped += stat._sum.resultCount || 0;
    console.log(`  ${stat.status}: ${stat._count._all} jobs (${(stat._sum.resultCount || 0).toLocaleString()} properties)`);
  });

  console.log(`  ---`);
  console.log(`  Total Jobs: ${totalJobs}`);
  console.log(`  Total Properties Scraped: ${totalScraped.toLocaleString()}`);

  // Properties by city
  const propertiesByCity = await prisma.property.groupBy({
    by: ['city'],
    _count: {
      _all: true
    },
    orderBy: {
      _count: {
        _all: 'desc'
      }
    },
    take: 10
  });

  console.log('\n🏙️  Top 10 Cities:');
  propertiesByCity.forEach((city, idx) => {
    console.log(`  ${idx + 1}. ${city.city || 'Unknown'}: ${city._count._all.toLocaleString()} properties`);
  });

  // Most recent scrapes
  const recentJobs = await prisma.scrapeJob.findMany({
    where: { status: 'completed' },
    orderBy: { id: 'desc' },
    take: 5,
    select: {
      searchTerm: true,
      resultCount: true,
      completedAt: true
    }
  });

  console.log('\n📅 Recent Completed Scrapes:');
  recentJobs.forEach((job, idx) => {
    const time = job.completedAt ? new Date(job.completedAt).toLocaleString() : 'N/A';
    console.log(`  ${idx + 1}. "${job.searchTerm}": ${job.resultCount} properties (${time})`);
  });

  // Average properties per successful scrape
  const avgStats = await prisma.scrapeJob.aggregate({
    where: {
      status: 'completed',
      resultCount: { gt: 0 }
    },
    _avg: {
      resultCount: true
    },
    _max: {
      resultCount: true
    },
    _min: {
      resultCount: true
    }
  });

  console.log('\n📈 Scrape Performance:');
  console.log(`  Average properties per scrape: ${avgStats._avg.resultCount?.toFixed(0) || 0}`);
  console.log(`  Max properties in single scrape: ${avgStats._max.resultCount || 0}`);
  console.log(`  Min properties in single scrape: ${avgStats._min.resultCount || 0}`);

  console.log('\n' + '=' .repeat(60));

  await prisma.$disconnect();
}

checkDatabaseStats()
  .then(() => {
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
