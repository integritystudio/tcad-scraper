#!/usr/bin/env npx tsx

import { prisma } from './src/lib/prisma';

async function checkPropertyCount() {
  console.log('\n📊 Database Property Statistics\n');
  console.log('=' .repeat(60));

  // Total properties
  const totalProperties = await prisma.property.count();
  console.log(`\n🏠 Total Properties: ${totalProperties.toLocaleString()}`);

  // Properties added in last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentProperties = await prisma.property.count({
    where: {
      createdAt: { gte: oneHourAgo }
    }
  });
  console.log(`📅 Added in last hour: ${recentProperties.toLocaleString()}`);

  // Properties by city (top 10)
  const propertiesByCity = await prisma.property.groupBy({
    by: ['city'],
    _count: true,
    orderBy: {
      _count: {
        city: 'desc'
      }
    },
    take: 10
  });

  console.log('\n🏙️  Top 10 Cities:');
  propertiesByCity.forEach((cityGroup, idx) => {
    console.log(`  ${idx + 1}. ${cityGroup.city || 'Unknown'}: ${cityGroup._count.toLocaleString()} properties`);
  });

  // Recent scrape job stats
  const recentJobs = await prisma.scrapeJob.findMany({
    where: {
      status: 'completed',
      resultCount: { gt: 0 }
    },
    select: {
      searchTerm: true,
      resultCount: true,
      completedAt: true,
    },
    orderBy: { id: 'desc' },
    take: 5
  });

  console.log('\n📝 Recent Successful Scrapes:');
  recentJobs.forEach((job, idx) => {
    const time = job.completedAt ? new Date(job.completedAt).toLocaleTimeString() : 'N/A';
    console.log(`  ${idx + 1}. "${job.searchTerm}": ${job.resultCount?.toLocaleString()} properties (${time})`);
  });

  // Overall scrape stats
  const jobStats = await prisma.scrapeJob.groupBy({
    by: ['status'],
    _count: true,
    _sum: {
      resultCount: true
    }
  });

  console.log('\n📋 Scrape Job Statistics:');
  jobStats.forEach(stat => {
    console.log(`  ${stat.status}: ${stat._count} jobs (${(stat._sum.resultCount || 0).toLocaleString()} properties)`);
  });

  console.log('\n' + '=' .repeat(60));

  await prisma.$disconnect();
}

checkPropertyCount().then(() => process.exit(0)).catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});
