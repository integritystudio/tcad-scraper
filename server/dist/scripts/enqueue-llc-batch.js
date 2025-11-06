#!/usr/bin/env node
"use strict";
/**
 * Enqueue LLC Property Searches
 * Queues LLC and limited company search terms
 */
Object.defineProperty(exports, "__esModule", { value: true });
const scraper_queue_1 = require("../queues/scraper.queue");
const logger_1 = require("../lib/logger");
const config_1 = require("../config");
const LLC_TERMS = [
    'LLC',
    'LLC.',
    'L.L.C.',
    'Limited Liability',
    'Limited',
    'LMTD',
    'Limit',
    'L L C',
    'LTD',
    'Co LLC',
];
async function enqueueLLCBatch() {
    logger_1.logger.info('🏭 Starting LLC Batch Enqueue');
    logger_1.logger.info(`Auto-refresh token enabled: ${config_1.config.scraper.autoRefreshToken}`);
    try {
        let successCount = 0;
        let failCount = 0;
        for (const term of LLC_TERMS) {
            try {
                const job = await scraper_queue_1.scraperQueue.add('scrape-properties', {
                    searchTerm: term,
                    userId: 'llc-batch-enqueue',
                    scheduled: true,
                }, {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000,
                    },
                    priority: 2,
                    removeOnComplete: 100,
                    removeOnFail: 50,
                });
                successCount++;
                logger_1.logger.info(`✅ [${successCount}/${LLC_TERMS.length}] Queued: "${term}" (Job ID: ${job.id})`);
            }
            catch (error) {
                failCount++;
                logger_1.logger.error(`❌ Failed to queue "${term}":`, error);
            }
        }
        logger_1.logger.info(`\n📊 Summary: ${successCount} queued, ${failCount} failed`);
        logger_1.logger.info('✨ LLC batch enqueue completed!');
    }
    catch (error) {
        logger_1.logger.error('❌ Fatal error:', error);
        process.exit(1);
    }
}
enqueueLLCBatch()
    .then(() => process.exit(0))
    .catch((error) => {
    logger_1.logger.error('❌ Script failed:', error);
    process.exit(1);
});
//# sourceMappingURL=enqueue-llc-batch.js.map