"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeDuplicatesFromQueue = removeDuplicatesFromQueue;
const scraper_queue_1 = require("../queues/scraper.queue");
const prisma_1 = require("../lib/prisma");
async function removeDuplicatesFromQueue(options = {}) {
    const { verbose = true, showProgress = true } = options;
    if (verbose) {
        console.log('🔍 Now checking for duplicates...\n');
    }
    // Get all pending jobs (waiting + delayed)
    const [waitingJobs, delayedJobs] = await Promise.all([
        scraper_queue_1.scraperQueue.getWaiting(),
        scraper_queue_1.scraperQueue.getDelayed(),
    ]);
    const allPendingJobs = [...waitingJobs, ...delayedJobs];
    if (verbose) {
        console.log(`📊 Queue State:`);
        console.log(`   Waiting: ${waitingJobs.length}`);
        console.log(`   Delayed: ${delayedJobs.length}`);
        console.log(`   Total Pending: ${allPendingJobs.length}\n`);
    }
    // Get completed search terms from database
    const completedTerms = await prisma_1.prisma.scrapeJob.findMany({
        where: { status: 'completed' },
        select: { searchTerm: true },
        distinct: ['searchTerm'],
    });
    const completedTermSet = new Set(completedTerms.map(j => j.searchTerm));
    // Track search terms and their job IDs
    const termMap = new Map();
    // Build map of search terms to jobs
    for (const job of allPendingJobs) {
        const term = job.data.searchTerm;
        let state = 'waiting';
        if (delayedJobs.includes(job))
            state = 'delayed';
        if (!termMap.has(term)) {
            termMap.set(term, []);
        }
        termMap.get(term).push({
            job,
            priority: job.opts.priority || 10,
            state
        });
    }
    // Find duplicates within pending jobs
    const duplicateTerms = Array.from(termMap.entries())
        .filter(([_, jobs]) => jobs.length > 1);
    // Find jobs that were already completed
    const alreadyCompletedTerms = Array.from(termMap.entries())
        .filter(([term, _]) => completedTermSet.has(term));
    if (verbose) {
        console.log(`🔍 Analysis:`);
        console.log(`   Unique pending terms: ${termMap.size}`);
        console.log(`   ❌ Terms with duplicate pending jobs: ${duplicateTerms.length}`);
        console.log(`   ✅ Terms already completed: ${alreadyCompletedTerms.length}`);
    }
    let totalToRemove = 0;
    // Count duplicates
    for (const [_, jobs] of duplicateTerms) {
        totalToRemove += jobs.length - 1; // Keep one
    }
    // Count already completed
    for (const [_, jobs] of alreadyCompletedTerms) {
        totalToRemove += jobs.length; // Remove all
    }
    if (verbose) {
        console.log(`   🗑️  Total jobs to remove: ${totalToRemove}\n`);
    }
    if (totalToRemove === 0) {
        if (verbose) {
            console.log('✅ No duplicates or completed terms found!');
        }
        return { removed: 0, failed: 0 };
    }
    // Show what we're removing
    if (verbose) {
        if (duplicateTerms.length > 0) {
            console.log('📝 Duplicate pending jobs:');
            const displayCount = showProgress ? 10 : duplicateTerms.length;
            duplicateTerms.slice(0, displayCount).forEach(([term, jobs]) => {
                console.log(`   "${term}": ${jobs.length} copies (keeping 1, removing ${jobs.length - 1})`);
            });
            if (duplicateTerms.length > displayCount) {
                console.log(`   ... and ${duplicateTerms.length - displayCount} more`);
            }
            console.log('');
        }
        if (alreadyCompletedTerms.length > 0) {
            console.log('📝 Already completed terms in queue:');
            const displayCount = showProgress ? 20 : alreadyCompletedTerms.length;
            alreadyCompletedTerms.slice(0, displayCount).forEach(([term, jobs]) => {
                console.log(`   "${term}": ${jobs.length} pending (removing all)`);
            });
            if (alreadyCompletedTerms.length > displayCount) {
                console.log(`   ... and ${alreadyCompletedTerms.length - displayCount} more`);
            }
            console.log('');
        }
        console.log(`🚀 Removing ${totalToRemove} duplicate/completed jobs...`);
    }
    let removed = 0;
    let failed = 0;
    // Remove duplicates (keep highest priority)
    for (const [term, jobs] of duplicateTerms) {
        // Sort by priority (lower number = higher priority)
        jobs.sort((a, b) => a.priority - b.priority);
        // Remove all but the first (highest priority) job
        for (let i = 1; i < jobs.length; i++) {
            try {
                await jobs[i].job.remove();
                removed++;
                if (showProgress && removed % 10 === 0) {
                    process.stdout.write(`\r   Progress: ${removed}/${totalToRemove} (${((removed / totalToRemove) * 100).toFixed(1)}%)`);
                }
            }
            catch (error) {
                failed++;
                if (verbose && failed <= 3) {
                    console.error(`${showProgress ? '\n' : ''}   ❌ Failed to remove job ${jobs[i].job.id}:`, error.message);
                }
            }
        }
    }
    // Remove already completed terms
    for (const [term, jobs] of alreadyCompletedTerms) {
        for (const jobInfo of jobs) {
            try {
                await jobInfo.job.remove();
                removed++;
                if (showProgress && removed % 10 === 0) {
                    process.stdout.write(`\r   Progress: ${removed}/${totalToRemove} (${((removed / totalToRemove) * 100).toFixed(1)}%)`);
                }
            }
            catch (error) {
                failed++;
                if (verbose && failed <= 3) {
                    console.error(`${showProgress ? '\n' : ''}   ❌ Failed to remove job ${jobInfo.job.id}:`, error.message);
                }
            }
        }
    }
    if (verbose) {
        if (showProgress) {
            console.log(''); // New line after progress
        }
        console.log(`\n✅ Cleanup complete!`);
        console.log(`   - Successfully removed: ${removed}`);
        console.log(`   - Failed to remove: ${failed}`);
    }
    return { removed, failed };
}
//# sourceMappingURL=deduplication.js.map