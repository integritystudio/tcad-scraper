#!/usr/bin/env npx tsx

import { Command } from 'commander';
import { scraperQueue } from '../queues/scraper.queue';
import { prisma } from '../lib/prisma';

const program = new Command();

program
  .name('data-cleaner')
  .description('Clean and optimize database and queue data')
  .version('1.0.0');

/**
 * Remove duplicate properties from database
 */
program
  .command('properties-duplicates')
  .description('Find and remove duplicate properties based on property_id')
  .option('--dry-run', 'Show what would be deleted without actually deleting')
  .action(async (options: any) => {
    console.log('🧹 Removing Duplicate Properties\n');
    console.log('='.repeat(70));

    // Find duplicates
    console.log('\n🔍 Finding duplicate property_ids...');

    const duplicates = await prisma.$queryRaw<Array<{ property_id: string; count: bigint }>>`
      SELECT property_id, COUNT(*) as count
      FROM "Property"
      GROUP BY property_id
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;

    console.log(`   Found ${duplicates.length} duplicate property_ids`);

    if (duplicates.length === 0) {
      console.log('\n✅ No duplicates found!');
      await cleanup();
      return;
    }

    const totalDuplicates = duplicates.reduce((sum, d) => sum + Number(d.count) - 1, 0);
    console.log(`   Total duplicate records to remove: ${totalDuplicates}`);

    if (options.dryRun) {
      console.log('\n📋 DRY RUN - Sample duplicates (would be removed):');
      duplicates.slice(0, 10).forEach((dup, idx) => {
        console.log(`   ${idx + 1}. Property ID: ${dup.property_id} (${Number(dup.count)} copies)`);
      });
      console.log('\nRun without --dry-run to actually remove duplicates.');
      await cleanup();
      return;
    }

    // Remove duplicates - keep the oldest record
    console.log('\n🗑️  Removing duplicates (keeping oldest record for each property_id)...');

    let removed = 0;
    for (const dup of duplicates) {
      // Get all records for this property_id
      const records = await prisma.property.findMany({
        where: { propertyId: dup.property_id },
        orderBy: { createdAt: 'asc' }
      });

      // Delete all but the first (oldest)
      const toDelete = records.slice(1).map(r => r.id);

      if (toDelete.length > 0) {
        await prisma.property.deleteMany({
          where: { id: { in: toDelete } }
        });
        removed += toDelete.length;

        if (removed % 100 === 0) {
          process.stdout.write(`\r   Progress: ${removed}/${totalDuplicates} removed`);
        }
      }
    }

    console.log(`\n\n✅ Removed ${removed} duplicate properties!`);

    // Show final stats
    const totalProperties = await prisma.property.count();
    console.log(`\n📊 Final property count: ${totalProperties.toLocaleString()}`);

    await cleanup();
  });

/**
 * Remove duplicate search terms from queue
 */
program
  .command('queue-duplicates')
  .description('Remove duplicate search terms from waiting queue')
  .action(async () => {
    console.log('🧹 Removing Duplicate Search Terms from Queue\n');
    console.log('='.repeat(60));

    const waitingJobs = await scraperQueue.getWaiting();
    console.log(`\n📊 Total waiting jobs: ${waitingJobs.length}`);

    // Track seen terms
    const seenTerms = new Set<string>();
    const duplicates: any[] = [];

    waitingJobs.forEach(job => {
      const term = job.data.searchTerm;
      if (seenTerms.has(term)) {
        duplicates.push(job);
      } else {
        seenTerms.add(term);
      }
    });

    console.log(`📊 Unique terms: ${seenTerms.size}`);
    console.log(`📊 Duplicate jobs: ${duplicates.length}`);

    if (duplicates.length === 0) {
      console.log('\n✅ No duplicates found in queue!');
      await cleanup();
      return;
    }

    // Remove duplicates
    console.log(`\n🗑️  Removing ${duplicates.length} duplicate jobs...`);

    let removed = 0;
    let failed = 0;

    for (const job of duplicates) {
      try {
        await job.remove();
        removed++;
        if (removed % 50 === 0) {
          process.stdout.write(`\r   Progress: ${removed}/${duplicates.length} (${((removed/duplicates.length)*100).toFixed(1)}%)`);
        }
      } catch (error: any) {
        failed++;
      }
    }

    console.log(`\n\n✅ Removed ${removed} duplicate jobs!`);
    if (failed > 0) {
      console.log(`   ⚠️  Failed to remove: ${failed}`);
    }

    const finalWaiting = await scraperQueue.getWaitingCount();
    console.log(`\n📊 Final waiting jobs: ${finalWaiting}`);

    await cleanup();
  });

/**
 * Filter short search terms
 */
program
  .command('short-terms')
  .description('Remove short or invalid search terms')
  .option('--min-length <n>', 'Minimum term length', '3')
  .option('--dry-run', 'Show what would be removed without removing')
  .action(async (options: any) => {
    console.log('🧹 Removing Short Search Terms\n');
    console.log('='.repeat(60));

    const minLength = parseInt(options.minLength);
    console.log(`\n📏 Minimum term length: ${minLength} characters`);

    // Find short terms in database
    const shortTermJobs = await prisma.scrapeJob.findMany({
      where: {
        searchTerm: {
          not: undefined
        }
      },
      select: { id: true, searchTerm: true }
    });

    const toDelete = shortTermJobs.filter(job => job.searchTerm.length < minLength);

    console.log(`\n📊 Total scrape jobs: ${shortTermJobs.length}`);
    console.log(`📊 Short terms (< ${minLength} chars): ${toDelete.length}`);

    if (toDelete.length === 0) {
      console.log('\n✅ No short terms found!');
      await cleanup();
      return;
    }

    if (options.dryRun) {
      console.log('\n📋 DRY RUN - Sample short terms (would be removed):');
      toDelete.slice(0, 20).forEach((job, idx) => {
        console.log(`   ${idx + 1}. "${job.searchTerm}" (length: ${job.searchTerm.length})`);
      });
      console.log('\nRun without --dry-run to actually remove these terms.');
      await cleanup();
      return;
    }

    // Remove short terms from database
    console.log(`\n🗑️  Removing ${toDelete.length} short terms from database...`);

    await prisma.scrapeJob.deleteMany({
      where: {
        id: { in: toDelete.map(j => j.id) }
      }
    });

    console.log(`✅ Removed ${toDelete.length} short terms from database!`);

    // Also remove from queue
    console.log('\n🔍 Checking queue for short terms...');
    const waitingJobs = await scraperQueue.getWaiting();
    const shortQueueJobs = waitingJobs.filter(job => job.data.searchTerm.length < minLength);

    if (shortQueueJobs.length > 0) {
      console.log(`   Found ${shortQueueJobs.length} short terms in queue`);
      console.log(`   Removing...`);

      let removed = 0;
      for (const job of shortQueueJobs) {
        try {
          await job.remove();
          removed++;
        } catch (error) {
          // Ignore errors
        }
      }

      console.log(`   ✅ Removed ${removed} short terms from queue!`);
    } else {
      console.log(`   ✅ No short terms in queue`);
    }

    await cleanup();
  });

/**
 * Filter numeric-only terms
 */
program
  .command('numeric-terms')
  .description('Remove search terms that are only numbers')
  .option('--dry-run', 'Show what would be removed without removing')
  .action(async (options: any) => {
    console.log('🧹 Removing Numeric-Only Search Terms\n');
    console.log('='.repeat(60));

    // Find numeric terms
    const allJobs = await prisma.scrapeJob.findMany({
      select: { id: true, searchTerm: true }
    });

    const numericJobs = allJobs.filter(job => /^\d+$/.test(job.searchTerm));

    console.log(`\n📊 Total scrape jobs: ${allJobs.length}`);
    console.log(`📊 Numeric-only terms: ${numericJobs.length}`);

    if (numericJobs.length === 0) {
      console.log('\n✅ No numeric-only terms found!');
      await cleanup();
      return;
    }

    if (options.dryRun) {
      console.log('\n📋 DRY RUN - Sample numeric terms (would be removed):');
      numericJobs.slice(0, 20).forEach((job, idx) => {
        console.log(`   ${idx + 1}. "${job.searchTerm}"`);
      });
      console.log('\nRun without --dry-run to actually remove these terms.');
      await cleanup();
      return;
    }

    // Remove from database
    console.log(`\n🗑️  Removing ${numericJobs.length} numeric terms...`);

    await prisma.scrapeJob.deleteMany({
      where: {
        id: { in: numericJobs.map(j => j.id) }
      }
    });

    console.log(`✅ Removed ${numericJobs.length} numeric terms from database!`);

    // Also remove from queue
    const waitingJobs = await scraperQueue.getWaiting();
    const numericQueueJobs = waitingJobs.filter(job => /^\d+$/.test(job.data.searchTerm));

    if (numericQueueJobs.length > 0) {
      console.log(`\n🔍 Found ${numericQueueJobs.length} numeric terms in queue, removing...`);

      let removed = 0;
      for (const job of numericQueueJobs) {
        try {
          await job.remove();
          removed++;
        } catch (error) {
          // Ignore errors
        }
      }

      console.log(`   ✅ Removed ${removed} from queue!`);
    }

    await cleanup();
  });

/**
 * Remove inefficient search terms (low yield)
 */
program
  .command('inefficient-terms')
  .description('Remove search terms with consistently low results')
  .option('--threshold <n>', 'Max average results to be considered inefficient', '5')
  .option('--min-attempts <n>', 'Minimum attempts before considering term inefficient', '2')
  .option('--dry-run', 'Show what would be removed without removing')
  .action(async (options: any) => {
    console.log('🧹 Removing Inefficient Search Terms\n');
    console.log('='.repeat(70));

    const threshold = parseInt(options.threshold);
    const minAttempts = parseInt(options.minAttempts);

    console.log(`\n📊 Criteria:`);
    console.log(`   - Average results <= ${threshold} properties`);
    console.log(`   - Minimum ${minAttempts} scrape attempts`);

    // Find terms and their average results
    const termStats = await prisma.scrapeJob.groupBy({
      by: ['searchTerm'],
      where: {
        status: 'completed'
      },
      _count: true,
      _avg: {
        resultCount: true
      }
    });

    const inefficientTerms = termStats.filter(stat =>
      stat._count >= minAttempts &&
      (stat._avg.resultCount || 0) <= threshold
    );

    console.log(`\n📊 Analyzed ${termStats.length} search terms`);
    console.log(`📊 Inefficient terms found: ${inefficientTerms.length}`);

    if (inefficientTerms.length === 0) {
      console.log('\n✅ No inefficient terms found!');
      await cleanup();
      return;
    }

    if (options.dryRun) {
      console.log('\n📋 DRY RUN - Sample inefficient terms (would be removed):');
      inefficientTerms.slice(0, 20).forEach((stat, idx) => {
        console.log(`   ${idx + 1}. "${stat.searchTerm}" - avg: ${(stat._avg.resultCount || 0).toFixed(1)} properties (${stat._count} attempts)`);
      });
      console.log('\nRun without --dry-run to actually remove these terms.');
      await cleanup();
      return;
    }

    // Remove from database
    const termsToRemove = inefficientTerms.map(t => t.searchTerm);
    console.log(`\n🗑️  Removing ${termsToRemove.length} inefficient terms from database...`);

    await prisma.scrapeJob.deleteMany({
      where: {
        searchTerm: { in: termsToRemove }
      }
    });

    console.log(`✅ Removed from database!`);

    // Remove from queue
    const waitingJobs = await scraperQueue.getWaiting();
    const inefficientQueueJobs = waitingJobs.filter(job =>
      termsToRemove.includes(job.data.searchTerm)
    );

    if (inefficientQueueJobs.length > 0) {
      console.log(`\n🔍 Found ${inefficientQueueJobs.length} inefficient terms in queue, removing...`);

      let removed = 0;
      for (const job of inefficientQueueJobs) {
        try {
          await job.remove();
          removed++;
          if (removed % 50 === 0) {
            process.stdout.write(`\r   Progress: ${removed}/${inefficientQueueJobs.length}`);
          }
        } catch (error) {
          // Ignore errors
        }
      }

      console.log(`\n   ✅ Removed ${removed} from queue!`);
    }

    await cleanup();
  });

/**
 * Comprehensive cleanup - all filters
 */
program
  .command('all')
  .description('Run all cleanup operations (short, numeric, duplicates, inefficient)')
  .option('--dry-run', 'Show what would be done without actually doing it')
  .action(async (options: any) => {
    console.log('🧹 COMPREHENSIVE DATA CLEANUP\n');
    console.log('='.repeat(70));

    if (options.dryRun) {
      console.log('\n⚠️  DRY RUN MODE - No data will be modified\n');
    }

    console.log('\n1️⃣  Removing short terms...');
    // Run short-terms command
    await program.parseAsync(['node', 'data-cleaner', 'short-terms', ...(options.dryRun ? ['--dry-run'] : [])]);

    console.log('\n2️⃣  Removing numeric terms...');
    // Run numeric-terms command
    await program.parseAsync(['node', 'data-cleaner', 'numeric-terms', ...(options.dryRun ? ['--dry-run'] : [])]);

    console.log('\n3️⃣  Removing queue duplicates...');
    // Run queue-duplicates command (no dry-run support)
    if (!options.dryRun) {
      await program.parseAsync(['node', 'data-cleaner', 'queue-duplicates']);
    }

    console.log('\n4️⃣  Removing property duplicates...');
    // Run properties-duplicates command
    await program.parseAsync(['node', 'data-cleaner', 'properties-duplicates', ...(options.dryRun ? ['--dry-run'] : [])]);

    console.log('\n✅ Comprehensive cleanup complete!');

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
