#!/usr/bin/env npx tsx

import { Command } from 'commander';
import { prisma } from '../lib/prisma';
import { scraperQueue } from '../queues/scraper.queue';
import logger from '../lib/logger';

interface StatsOptions {
  byCity?: boolean;
  byType?: boolean;
  top?: string;
  days?: string;
  limit?: string;
  recent?: string;
}

const program = new Command();

program
  .name('db-stats')
  .description('Display database statistics and metrics')
  .version('1.0.0');

/**
 * Show comprehensive summary statistics
 */
program
  .command('summary')
  .description('Show comprehensive database statistics summary')
  .action(async () => {
    logger.info('📊 Database Statistics Summary\n');
    logger.info('='.repeat(70));

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
      logger.info(`   ${stat.status}: ${stat._count._all} jobs (${(stat._sum.resultCount || 0).toLocaleString()} properties)`);
    });

    logger.info(`   ---`);
    logger.info(`   Total Jobs: ${totalJobs}`);
    logger.info(`   Total Properties Scraped: ${totalScraped.toLocaleString()}`);

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
    logger.info(`   Average properties per scrape: ${avgStats._avg.resultCount?.toFixed(0) || 0}`);
    logger.info(`   Max properties in single scrape: ${avgStats._max.resultCount || 0}`);
    logger.info(`   Min properties in single scrape: ${avgStats._min.resultCount || 0}`);

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
      logger.info(`   ${idx + 1}. "${job.searchTerm}": ${job.resultCount} properties (${time})`);
    });

    logger.info('\n' + '='.repeat(70));

    await cleanup();
  });

/**
 * Show property statistics
 */
program
  .command('properties')
  .description('Show detailed property statistics')
  .option('--by-city', 'Show properties grouped by city')
  .option('--by-type', 'Show properties grouped by type')
  .option('--top <n>', 'Show top N results', '10')
  .action(async (options: StatsOptions) => {
    logger.info('🏠 Property Statistics\n');
    logger.info('='.repeat(70));

    const totalProperties = await prisma.property.count();
    logger.info(`\n📊 Total Properties: ${totalProperties.toLocaleString()}`);

    // By city
    if (options.byCity) {
      const propertiesByCity = await prisma.property.groupBy({
        by: ['city'],
        _count: {
          id: true
        },
        orderBy: {
          _count: {
            id: 'desc'
          }
        },
        take: parseInt(options.top || '0')
      });

      logger.info(`\n🏙️  Top ${options.top} Cities:`);
      propertiesByCity.forEach((city, idx) => {
        const count = city._count.id;
        const pct = ((count / totalProperties) * 100).toFixed(1);
        logger.info(`   ${idx + 1}. ${city.city || 'Unknown'}: ${count.toLocaleString()} (${pct}%)`);
      });
    }

    // By property type
    if (options.byType) {
      const propertiesByType = await prisma.property.groupBy({
        by: ['propType'],
        _count: {
          id: true
        },
        orderBy: {
          _count: {
            id: 'desc'
          }
        },
        take: parseInt(options.top || '0')
      });

      logger.info(`\n🏗️  Top ${options.top} Property Types:`);
      propertiesByType.forEach((type, idx) => {
        const count = type._count.id;
        const pct = ((count / totalProperties) * 100).toFixed(1);
        logger.info(`   ${idx + 1}. ${type.propType}: ${count.toLocaleString()} (${pct}%)`);
      });
    }

    // Value statistics
    const valueStats = await prisma.property.aggregate({
      _avg: {
        appraisedValue: true,
        assessedValue: true
      },
      _max: {
        appraisedValue: true,
        assessedValue: true
      },
      _min: {
        appraisedValue: true,
        assessedValue: true
      }
    });

    logger.info('\n💰 Property Values:');
    logger.info(`   Average Appraised: $${(valueStats._avg.appraisedValue || 0).toLocaleString()}`);
    logger.info(`   Max Appraised: $${(valueStats._max.appraisedValue || 0).toLocaleString()}`);
    logger.info(`   Min Appraised: $${(valueStats._min.appraisedValue || 0).toLocaleString()}`);
    logger.info(`   Average Assessed: $${(valueStats._avg.assessedValue || 0).toLocaleString()}`);

    logger.info('\n' + '='.repeat(70));

    await cleanup();
  });

/**
 * Show scraping rate and progress
 */
program
  .command('rate')
  .description('Show scraping rate and time-based statistics')
  .option('--days <n>', 'Analyze last N days', '7')
  .action(async (options: StatsOptions) => {
    logger.info('⚡ Scraping Rate Analysis\n');
    logger.info('='.repeat(70));

    const days = parseInt(options.days || '0');
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get jobs completed in timeframe
    const recentJobs = await prisma.scrapeJob.findMany({
      where: {
        status: 'completed',
        completedAt: { gte: since }
      },
      select: {
        resultCount: true,
        completedAt: true,
        startedAt: true
      }
    });

    logger.info(`\n📅 Last ${days} days:`);
    logger.info(`   Jobs completed: ${recentJobs.length}`);

    const totalProperties = recentJobs.reduce((sum, j) => sum + (j.resultCount || 0), 0);
    logger.info(`   Properties scraped: ${totalProperties.toLocaleString()}`);

    const jobsPerDay = recentJobs.length / days;
    const propertiesPerDay = totalProperties / days;

    logger.info(`\n📈 Rates:`);
    logger.info(`   Jobs per day: ${jobsPerDay.toFixed(1)}`);
    logger.info(`   Properties per day: ${propertiesPerDay.toFixed(0)}`);
    logger.info(`   Avg properties per job: ${(totalProperties / recentJobs.length || 0).toFixed(1)}`);

    // Calculate processing time
    const processingTimes = recentJobs
      .filter(j => j.startedAt && j.completedAt)
      .map(j => {
        const created = new Date(j.startedAt!).getTime();
        const completed = new Date(j.completedAt!).getTime();
        return (completed - created) / 1000; // seconds
      });

    if (processingTimes.length > 0) {
      const avgTime = processingTimes.reduce((sum, t) => sum + t, 0) / processingTimes.length;

      logger.info(`\n⏱️  Average Processing Time:`);
      logger.info(`   ${(avgTime / 60).toFixed(1)} minutes per job`);
    }

    // Get queue status
    const [waiting, active] = await Promise.all([
      scraperQueue.getWaitingCount(),
      scraperQueue.getActiveCount()
    ]);

    logger.info(`\n📊 Current Queue:`);
    logger.info(`   Waiting: ${waiting}`);
    logger.info(`   Active: ${active}`);

    // Estimate completion time
    if (waiting > 0 && jobsPerDay > 0) {
      const daysToComplete = waiting / jobsPerDay;
      logger.info(`\n⏳ Estimated time to clear queue:`);
      logger.info(`   ${daysToComplete.toFixed(1)} days at current rate`);
    }

    logger.info('\n' + '='.repeat(70));

    await cleanup();
  });

/**
 * Show search term statistics
 */
program
  .command('search-terms')
  .description('Show statistics about search terms')
  .option('--top <n>', 'Show top N most productive terms', '10')
  .action(async (options: StatsOptions) => {
    logger.info('🔍 Search Term Statistics\n');
    logger.info('='.repeat(70));

    // Count distinct search terms
    const distinctTerms = await prisma.scrapeJob.findMany({
      select: { searchTerm: true },
      distinct: ['searchTerm']
    });

    logger.info(`\n📊 Total distinct search terms: ${distinctTerms.length.toLocaleString()}`);

    // Terms by status
    const termsByStatus = await prisma.scrapeJob.groupBy({
      by: ['status'],
      _count: {
        searchTerm: true
      }
    });

    logger.info('\n📋 Search Terms by Status:');
    termsByStatus.forEach(stat => {
      logger.info(`   ${stat.status}: ${stat._count.searchTerm} terms`);
    });

    // Most productive terms
    const topTerms = await prisma.scrapeJob.findMany({
      where: {
        status: 'completed',
        resultCount: { gt: 0 }
      },
      orderBy: {
        resultCount: 'desc'
      },
      take: parseInt(options.top || '0'),
      select: {
        searchTerm: true,
        resultCount: true
      }
    });

    logger.info(`\n🏆 Top ${options.top} Most Productive Terms:`);
    topTerms.forEach((term, idx) => {
      logger.info(`   ${idx + 1}. "${term.searchTerm}": ${(term.resultCount || 0).toLocaleString()} properties`);
    });

    // Zero result terms
    const zeroResultCount = await prisma.scrapeJob.count({
      where: {
        status: 'completed',
        resultCount: 0
      }
    });

    logger.info(`\n❌ Zero-result scrapes: ${zeroResultCount}`);

    // Average results per term
    const avgResults = await prisma.scrapeJob.aggregate({
      where: {
        status: 'completed',
        resultCount: { gt: 0 }
      },
      _avg: {
        resultCount: true
      }
    });

    logger.info(`📊 Average results per successful term: ${(avgResults._avg.resultCount || 0).toFixed(1)}`);

    logger.info('\n' + '='.repeat(70));

    await cleanup();
  });

/**
 * Show priority job results
 */
program
  .command('priority')
  .description('Show statistics for priority jobs')
  .option('--recent <n>', 'Show last N priority jobs', '10')
  .action(async (options: StatsOptions) => {
    logger.info('⭐ Priority Job Statistics\n');
    logger.info('='.repeat(70));

    // This assumes priority jobs were marked with specific search terms
    // Adjust the query based on how priority jobs are identified
    const priorityJobs = await prisma.scrapeJob.findMany({
      where: {
        searchTerm: { in: ['Estate', 'Family', 'Trust'] }
      },
      select: {
        searchTerm: true,
        status: true,
        resultCount: true,
        completedAt: true,
        startedAt: true
      },
      orderBy: {
        startedAt: 'desc'
      },
      take: parseInt(options.recent || '0')
    });

    logger.info(`\n📊 Priority jobs found: ${priorityJobs.length}`);

    if (priorityJobs.length === 0) {
      logger.info('\nNo priority jobs found in database.');
      await cleanup();
      return;
    }

    // Group by status
    const statusCounts: Record<string, number> = {};
    let totalResults = 0;

    priorityJobs.forEach(job => {
      statusCounts[job.status] = (statusCounts[job.status] || 0) + 1;
      totalResults += job.resultCount || 0;
    });

    logger.info('\n📋 By Status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      logger.info(`   ${status}: ${count}`);
    });

    logger.info(`\n📈 Total properties from priority jobs: ${totalResults.toLocaleString()}`);
    logger.info(`📈 Average per priority job: ${(totalResults / priorityJobs.length).toFixed(1)}`);

    logger.info(`\n📅 Recent Priority Jobs:`);
    priorityJobs.forEach((job, idx) => {
      const status = job.status === 'completed' ? '✅' : job.status === 'failed' ? '❌' : '⏳';
      const results = job.status === 'completed' ? ` (${job.resultCount} props)` : '';
      logger.info(`   ${idx + 1}. ${status} "${job.searchTerm}"${results}`);
    });

    logger.info('\n' + '='.repeat(70));

    await cleanup();
  });

/**
 * Show all statistics - comprehensive view
 */
program
  .command('all')
  .description('Show all available statistics (comprehensive report)')
  .action(async () => {
    logger.info('📊 COMPREHENSIVE DATABASE REPORT\n');
    logger.info('='.repeat(70));

    // Run all stat commands
    logger.info('\n1️⃣  SUMMARY\n');
    await program.parseAsync(['node', 'db-stats', 'summary']);

    logger.info('\n2️⃣  PROPERTIES\n');
    await program.parseAsync(['node', 'db-stats', 'properties', '--by-city', '--by-type']);

    logger.info('\n3️⃣  SCRAPING RATE\n');
    await program.parseAsync(['node', 'db-stats', 'rate']);

    logger.info('\n4️⃣  SEARCH TERMS\n');
    await program.parseAsync(['node', 'db-stats', 'search-terms']);

    logger.info('\n✅ Comprehensive report complete!\n');
    logger.info('='.repeat(70));

    await cleanup();
  });

/**
 * Helper function to cleanup connections
 */
async function cleanup() {
  await scraperQueue.close();
  await prisma.$disconnect();
}

// Handle errors and cleanup
process.on('SIGINT', async () => {
  logger.info('\n\n👋 Interrupted. Cleaning up...');
  await cleanup();
  process.exit(0);
});

process.on('unhandledRejection', async (reason: unknown) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logger.error(error, '\n❌ Unhandled error');
  await cleanup();
  process.exit(1);
});

// Parse arguments
program.parse();
