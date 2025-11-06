#!/usr/bin/env node
"use strict";
/**
 * Enqueue Residential Property Searches
 * Queues common residential property search terms
 */
Object.defineProperty(exports, "__esModule", { value: true });
const scraper_queue_1 = require("../queues/scraper.queue");
const logger_1 = require("../lib/logger");
const config_1 = require("../config");
const RESIDENTIAL_TERMS = [
    'Smith',
    'Johnson',
    'Williams',
    'Brown',
    'Jones',
    'Miller',
    'Davis',
    'Garcia',
    'Rodriguez',
    'Wilson',
];
async function enqueueResidentialBatch() {
    logger_1.logger.info('🏠 Starting Residential Batch Enqueue');
    logger_1.logger.info(`Auto-refresh token enabled: ${config_1.config.scraper.autoRefreshToken}`);
    logger_1.logger.info(`Token refresh interval: ${config_1.config.scraper.tokenRefreshInterval}ms`);
    try {
        let successCount = 0;
        let failCount = 0;
        for (const term of RESIDENTIAL_TERMS) {
            try {
                const job = await scraper_queue_1.scraperQueue.add('scrape-properties', {
                    searchTerm: term,
                    userId: 'residential-batch-enqueue',
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
                successCount++;
                logger_1.logger.info(`✅ [${successCount}/${RESIDENTIAL_TERMS.length}] Queued: "${term}" (Job ID: ${job.id})`);
            }
            catch (error) {
                failCount++;
                logger_1.logger.error(`❌ Failed to queue "${term}":`, error);
            }
        }
        logger_1.logger.info(`\n📊 Summary: ${successCount} queued, ${failCount} failed`);
        logger_1.logger.info('✨ Residential batch enqueue completed!');
    }
    catch (error) {
        logger_1.logger.error('❌ Fatal error:', error);
        process.exit(1);
    }
}
enqueueResidentialBatch()
    .then(() => process.exit(0))
    .catch((error) => {
    logger_1.logger.error('❌ Script failed:', error);
    process.exit(1);
});
//# sourceMappingURL=enqueue-residential-batch.js.map