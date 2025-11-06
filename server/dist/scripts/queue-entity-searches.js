"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const scraper_queue_1 = require("../queues/scraper.queue");
/**
 * Queue 50 high-yield entity term searches based on optimal search strategy
 *
 * Priority: Entity terms perform best (~70+ properties/search)
 * These terms target trusts, LLCs, partnerships, and corporations
 */
const ENTITY_TERMS = [
    // Trust/Estate terms (highest yield)
    'Trust',
    'Estate',
    'Family',
    'Revocable',
    'Irrevocable',
    // Business entities - LLC variations
    'LLC.',
    'LLC',
    'L.L.C',
    'L.L.C.',
    'Limited',
    'Limit',
    'LMTD',
    // Business entities - Corporation
    'Corp',
    'Corp.',
    'Corporation',
    'Inc.',
    'Inc',
    'Incorporated',
    // Partnership terms
    'Part',
    'Partnership',
    'Partners',
    'Assoc',
    'Association',
    'Associates',
    // Property/Real Estate terms
    'Real',
    'Realty',
    'Properties',
    'Property',
    'Park',
    'Parc',
    'Plaza',
    'Center',
    // Management/Investment terms
    'Manage',
    'Management',
    'Investments',
    'Holdings',
    'Group',
    'Ventures',
    // Other entity terms
    'Home',
    'Homes',
    'Company',
    'Foundation',
    'Fund',
    'Capital',
    'Development',
    'Builders',
    'Construction',
];
async function queueEntitySearches() {
    console.log('🔄 Queuing Entity Term Searches for TCAD Scraper\n');
    console.log('='.repeat(80) + '\n');
    try {
        // Take first 50 entity terms
        const searchTerms = ENTITY_TERMS.slice(0, 50);
        console.log(`Queuing ${searchTerms.length} high-yield entity term searches...\n`);
        const jobs = [];
        let queuedCount = 0;
        let failedCount = 0;
        for (const searchTerm of searchTerms) {
            try {
                const job = await scraper_queue_1.scraperQueue.add('scrape-properties', {
                    searchTerm,
                    userId: 'entity-batch-scraper',
                    scheduled: true,
                }, {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000,
                    },
                    removeOnComplete: 100,
                    removeOnFail: 50,
                });
                jobs.push(job);
                queuedCount++;
                console.log(`✅ [${queuedCount}/${searchTerms.length}] Queued: "${searchTerm}" (Job ID: ${job.id})`);
            }
            catch (error) {
                failedCount++;
                console.error(`❌ Failed to queue "${searchTerm}":`, error instanceof Error ? error.message : 'Unknown error');
            }
        }
        console.log('\n' + '─'.repeat(80));
        console.log('QUEUE SUMMARY');
        console.log('─'.repeat(80) + '\n');
        console.log(`✅ Successfully queued: ${queuedCount} jobs`);
        console.log(`❌ Failed to queue: ${failedCount} jobs`);
        console.log(`📊 Total jobs added: ${queuedCount}`);
        if (queuedCount > 0) {
            console.log('\n' + '='.repeat(80));
            console.log('MONITORING');
            console.log('='.repeat(80) + '\n');
            console.log('🎯 Bull Board Dashboard: http://localhost:3001/admin/queues');
            console.log('   Monitor job progress, view completed/failed jobs, and queue stats\n');
            console.log('📈 Expected Results:');
            console.log(`   - Entity terms average: ~70 properties/search`);
            console.log(`   - Estimated total properties: ${queuedCount * 70} (if all succeed)`);
            console.log(`   - Processing time: ~${Math.ceil(queuedCount / 2 * 15 / 60)} hours (2 concurrent workers)\n`);
        }
        console.log('✨ Entity term searches queued successfully!\n');
    }
    catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}
// Run the script
queueEntitySearches()
    .then(() => {
    console.log('✅ Script completed. Jobs are now processing...');
    process.exit(0);
})
    .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
});
//# sourceMappingURL=queue-entity-searches.js.map