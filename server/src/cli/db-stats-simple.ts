#!/usr/bin/env npx tsx

import { prisma } from '../lib/prisma';
import logger from '../lib/logger';

async function checkDatabaseStats() {
  logger.info('📊 Database Statistics\n');
  logger.info('=' .repeat(60));

  // Count total properties
  const totalProperties = await prisma.property.count();
  logger.info(`\n🏠 Total Properties: ${totalProperties.toLocaleString()}`);

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

  logger.info('\n📋 Scrape Jobs:');
  let totalJobs = 0;
  let totalScraped = 0;

  jobStats.forEach(stat => {
    totalJobs += stat._count._all;
    totalScraped += stat._sum.resultCount || 0;
    logger.info(`  ${stat.status}: ${stat._count._all} jobs (${(stat._sum.resultCount || 0).toLocaleString()} properties)`);
  });

  logger.info(`  ---`);
  logger.info(`  Total Jobs: ${totalJobs}`);
  logger.info(`  Total Properties Scraped: ${totalScraped.toLocaleString()}`);

  // Properties by city
  const propertiesByCity = await prisma.property.groupBy({
    by: ['city'],
    _count: {
      _all: true
    },
    orderBy: {
      _count: {
        city: 'desc'
      }
    },
    take: 10
  });

  logger.info('\n🏙️  Top 10 Cities:');
  propertiesByCity.forEach((city, idx) => {
    logger.info(`  ${idx + 1}. ${city.city || 'Unknown'}: ${city._count?._all?.toLocaleString() ?? 0} properties`);
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

  logger.info('\n📅 Recent Completed Scrapes:');
  recentJobs.forEach((job, idx) => {
    const time = job.completedAt ? new Date(job.completedAt).toLocaleString() : 'N/A';
    logger.info(`  ${idx + 1}. "${job.searchTerm}": ${job.resultCount} properties (${time})`);
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

  logger.info('\n📈 Scrape Performance:');
  logger.info(`  Average properties per scrape: ${avgStats._avg.resultCount?.toFixed(0) || 0}`);
  logger.info(`  Max properties in single scrape: ${avgStats._max.resultCount || 0}`);
  logger.info(`  Min properties in single scrape: ${avgStats._min.resultCount || 0}`);

  logger.info('\n' + '=' .repeat(60));

  await prisma.$disconnect();
}

checkDatabaseStats()
  .then(() => {
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
