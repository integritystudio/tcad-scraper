#!/usr/bin/env npx tsx

import { Command } from 'commander';
import { prisma } from '../lib/prisma';
import { scraperQueue } from '../queues/scraper.queue';

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
    console.log('📊 Database Statistics Summary\n');
    console.log('='.repeat(70));

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
      console.log(`   ${stat.status}: ${stat._count._all} jobs (${(stat._sum.resultCount || 0).toLocaleString()} properties)`);
    });

    console.log(`   ---`);
    console.log(`   Total Jobs: ${totalJobs}`);
    console.log(`   Total Properties Scraped: ${totalScraped.toLocaleString()}`);

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
    console.log(`   Average properties per scrape: ${avgStats._avg.resultCount?.toFixed(0) || 0}`);
    console.log(`   Max properties in single scrape: ${avgStats._max.resultCount || 0}`);
    console.log(`   Min properties in single scrape: ${avgStats._min.resultCount || 0}`);

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
      console.log(`   ${idx + 1}. "${job.searchTerm}": ${job.resultCount} properties (${time})`);
    });

    console.log('\n' + '='.repeat(70));

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
  .action(async (options: any) => {
    console.log('🏠 Property Statistics\n');
    console.log('='.repeat(70));

    const totalProperties = await prisma.property.count();
    console.log(`\n📊 Total Properties: ${totalProperties.toLocaleString()}`);

    // By city
    if (options.byCity) {
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
        take: parseInt(options.top)
      });

      console.log(`\n🏙️  Top ${options.top} Cities:`);
      propertiesByCity.forEach((city, idx) => {
        const pct = ((city._count._all / totalProperties) * 100).toFixed(1);
        console.log(`   ${idx + 1}. ${city.city || 'Unknown'}: ${city._count._all.toLocaleString()} (${pct}%)`);
      });
    }

    // By property type
    if (options.byType) {
      const propertiesByType = await prisma.property.groupBy({
        by: ['propType'],
        _count: {
          _all: true
        },
        orderBy: {
          _count: {
            _all: 'desc'
          }
        },
        take: parseInt(options.top)
      });

      console.log(`\n🏗️  Top ${options.top} Property Types:`);
      propertiesByType.forEach((type, idx) => {
        const pct = ((type._count._all / totalProperties) * 100).toFixed(1);
        console.log(`   ${idx + 1}. ${type.propType}: ${type._count._all.toLocaleString()} (${pct}%)`);
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

    console.log('\n💰 Property Values:');
    console.log(`   Average Appraised: $${(valueStats._avg.appraisedValue || 0).toLocaleString()}`);
    console.log(`   Max Appraised: $${(valueStats._max.appraisedValue || 0).toLocaleString()}`);
    console.log(`   Min Appraised: $${(valueStats._min.appraisedValue || 0).toLocaleString()}`);
    console.log(`   Average Assessed: $${(valueStats._avg.assessedValue || 0).toLocaleString()}`);

    console.log('\n' + '='.repeat(70));

    await cleanup();
  });

/**
 * Show scraping rate and progress
 */
program
  .command('rate')
  .description('Show scraping rate and time-based statistics')
  .option('--days <n>', 'Analyze last N days', '7')
  .action(async (options: any) => {
    console.log('⚡ Scraping Rate Analysis\n');
    console.log('='.repeat(70));

    const days = parseInt(options.days);
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
        createdAt: true
      }
    });

    console.log(`\n📅 Last ${days} days:`);
    console.log(`   Jobs completed: ${recentJobs.length}`);

    const totalProperties = recentJobs.reduce((sum, j) => sum + (j.resultCount || 0), 0);
    console.log(`   Properties scraped: ${totalProperties.toLocaleString()}`);

    const jobsPerDay = recentJobs.length / days;
    const propertiesPerDay = totalProperties / days;

    console.log(`\n📈 Rates:`);
    console.log(`   Jobs per day: ${jobsPerDay.toFixed(1)}`);
    console.log(`   Properties per day: ${propertiesPerDay.toFixed(0)}`);
    console.log(`   Avg properties per job: ${(totalProperties / recentJobs.length || 0).toFixed(1)}`);

    // Calculate processing time
    const processingTimes = recentJobs
      .filter(j => j.createdAt && j.completedAt)
      .map(j => {
        const created = new Date(j.createdAt!).getTime();
        const completed = new Date(j.completedAt!).getTime();
        return (completed - created) / 1000; // seconds
      });

    if (processingTimes.length > 0) {
      const avgTime = processingTimes.reduce((sum, t) => sum + t, 0) / processingTimes.length;

      console.log(`\n⏱️  Average Processing Time:`);
      console.log(`   ${(avgTime / 60).toFixed(1)} minutes per job`);
    }

    // Get queue status
    const [waiting, active] = await Promise.all([
      scraperQueue.getWaitingCount(),
      scraperQueue.getActiveCount()
    ]);

    console.log(`\n📊 Current Queue:`);
    console.log(`   Waiting: ${waiting}`);
    console.log(`   Active: ${active}`);

    // Estimate completion time
    if (waiting > 0 && jobsPerDay > 0) {
      const daysToComplete = waiting / jobsPerDay;
      console.log(`\n⏳ Estimated time to clear queue:`);
      console.log(`   ${daysToComplete.toFixed(1)} days at current rate`);
    }

    console.log('\n' + '='.repeat(70));

    await cleanup();
  });

/**
 * Show search term statistics
 */
program
  .command('search-terms')
  .description('Show statistics about search terms')
  .option('--top <n>', 'Show top N most productive terms', '10')
  .action(async (options: any) => {
    console.log('🔍 Search Term Statistics\n');
    console.log('='.repeat(70));

    // Count distinct search terms
    const distinctTerms = await prisma.scrapeJob.findMany({
      select: { searchTerm: true },
      distinct: ['searchTerm']
    });

    console.log(`\n📊 Total distinct search terms: ${distinctTerms.length.toLocaleString()}`);

    // Terms by status
    const termsByStatus = await prisma.scrapeJob.groupBy({
      by: ['status'],
      _count: {
        searchTerm: true
      }
    });

    console.log('\n📋 Search Terms by Status:');
    termsByStatus.forEach(stat => {
      console.log(`   ${stat.status}: ${stat._count.searchTerm} terms`);
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
      take: parseInt(options.top),
      select: {
        searchTerm: true,
        resultCount: true
      }
    });

    console.log(`\n🏆 Top ${options.top} Most Productive Terms:`);
    topTerms.forEach((term, idx) => {
      console.log(`   ${idx + 1}. "${term.searchTerm}": ${(term.resultCount || 0).toLocaleString()} properties`);
    });

    // Zero result terms
    const zeroResultCount = await prisma.scrapeJob.count({
      where: {
        status: 'completed',
        resultCount: 0
      }
    });

    console.log(`\n❌ Zero-result scrapes: ${zeroResultCount}`);

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

    console.log(`📊 Average results per successful term: ${(avgResults._avg.resultCount || 0).toFixed(1)}`);

    console.log('\n' + '='.repeat(70));

    await cleanup();
  });

/**
 * Show priority job results
 */
program
  .command('priority')
  .description('Show statistics for priority jobs')
  .option('--recent <n>', 'Show last N priority jobs', '10')
  .action(async (options: any) => {
    console.log('⭐ Priority Job Statistics\n');
    console.log('='.repeat(70));

    // This assumes priority jobs were marked with a specific userId or pattern
    // Adjust the query based on how priority jobs are identified
    const priorityJobs = await prisma.scrapeJob.findMany({
      where: {
        OR: [
          { userId: { contains: 'priority' } },
          { searchTerm: { in: ['Estate', 'Family', 'Trust'] } }
        ]
      },
      select: {
        searchTerm: true,
        status: true,
        resultCount: true,
        completedAt: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: parseInt(options.recent)
    });

    console.log(`\n📊 Priority jobs found: ${priorityJobs.length}`);

    if (priorityJobs.length === 0) {
      console.log('\nNo priority jobs found in database.');
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

    console.log('\n📋 By Status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    console.log(`\n📈 Total properties from priority jobs: ${totalResults.toLocaleString()}`);
    console.log(`📈 Average per priority job: ${(totalResults / priorityJobs.length).toFixed(1)}`);

    console.log(`\n📅 Recent Priority Jobs:`);
    priorityJobs.forEach((job, idx) => {
      const status = job.status === 'completed' ? '✅' : job.status === 'failed' ? '❌' : '⏳';
      const results = job.status === 'completed' ? ` (${job.resultCount} props)` : '';
      console.log(`   ${idx + 1}. ${status} "${job.searchTerm}"${results}`);
    });

    console.log('\n' + '='.repeat(70));

    await cleanup();
  });

/**
 * Show all statistics - comprehensive view
 */
program
  .command('all')
  .description('Show all available statistics (comprehensive report)')
  .action(async () => {
    console.log('📊 COMPREHENSIVE DATABASE REPORT\n');
    console.log('='.repeat(70));

    // Run all stat commands
    console.log('\n1️⃣  SUMMARY\n');
    await program.parseAsync(['node', 'db-stats', 'summary']);

    console.log('\n2️⃣  PROPERTIES\n');
    await program.parseAsync(['node', 'db-stats', 'properties', '--by-city', '--by-type']);

    console.log('\n3️⃣  SCRAPING RATE\n');
    await program.parseAsync(['node', 'db-stats', 'rate']);

    console.log('\n4️⃣  SEARCH TERMS\n');
    await program.parseAsync(['node', 'db-stats', 'search-terms']);

    console.log('\n✅ Comprehensive report complete!\n');
    console.log('='.repeat(70));

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
  console.log('\n\n👋 Interrupted. Cleaning up...');
  await cleanup();
  process.exit(0);
});

process.on('unhandledRejection', async (error: any) => {
  console.error('\n❌ Unhandled error:', error.message);
  await cleanup();
  process.exit(1);
});

// Parse arguments
program.parse();
