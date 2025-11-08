"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const scraper_queue_1 = require("../queues/scraper.queue");
const logger_1 = __importDefault(require("../lib/logger"));
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
    logger_1.default.info('🔄 Queuing Entity Term Searches for TCAD Scraper\n');
    logger_1.default.info('='.repeat(80) + '\n');
    try {
        // Take first 50 entity terms
        const searchTerms = ENTITY_TERMS.slice(0, 50);
        logger_1.default.info(`Queuing ${searchTerms.length} high-yield entity term searches...\n`);
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
                logger_1.default.info(`✅ [${queuedCount}/${searchTerms.length}] Queued: "${searchTerm}" (Job ID: ${job.id})`);
            }
            catch (error) {
                failedCount++;
                logger_1.default.error(`❌ Failed to queue "${searchTerm}":`, error instanceof Error ? error.message : 'Unknown error');
            }
        }
        logger_1.default.info('\n' + '─'.repeat(80));
        logger_1.default.info('QUEUE SUMMARY');
        logger_1.default.info('─'.repeat(80) + '\n');
        logger_1.default.info(`✅ Successfully queued: ${queuedCount} jobs`);
        logger_1.default.info(`❌ Failed to queue: ${failedCount} jobs`);
        logger_1.default.info(`📊 Total jobs added: ${queuedCount}`);
        if (queuedCount > 0) {
            logger_1.default.info('\n' + '='.repeat(80));
            logger_1.default.info('MONITORING');
            logger_1.default.info('='.repeat(80) + '\n');
            logger_1.default.info('🎯 Bull Board Dashboard: http://localhost:3001/admin/queues');
            logger_1.default.info('   Monitor job progress, view completed/failed jobs, and queue stats\n');
            logger_1.default.info('📈 Expected Results:');
            logger_1.default.info(`   - Entity terms average: ~70 properties/search`);
            logger_1.default.info(`   - Estimated total properties: ${queuedCount * 70} (if all succeed)`);
            logger_1.default.info(`   - Processing time: ~${Math.ceil(queuedCount / 2 * 15 / 60)} hours (2 concurrent workers)\n`);
        }
        logger_1.default.info('✨ Entity term searches queued successfully!\n');
    }
    catch (error) {
        logger_1.default.error('❌ Fatal error:', error);
        process.exit(1);
    }
}
// Run the script
queueEntitySearches()
    .then(() => {
    logger_1.default.info('✅ Script completed. Jobs are now processing...');
    process.exit(0);
})
    .catch((error) => {
    logger_1.default.error('❌ Script failed:', error);
    process.exit(1);
});
//# sourceMappingURL=queue-entity-searches.js.map