#!/usr/bin/env node
"use strict";
/**
 * Enqueue Foundation & Nonprofit Searches
 * Queues foundation, nonprofit, and charitable organization search terms
 */
Object.defineProperty(exports, "__esModule", { value: true });
const scraper_queue_1 = require("../queues/scraper.queue");
const logger_1 = require("../lib/logger");
const config_1 = require("../config");
const FOUNDATION_TERMS = [
    'Foundation',
    'Charitable',
    'Charity',
    'Nonprofit',
    'Non-Profit',
    'Organization',
    'Institute',
    'Society',
    'Association',
    'Endowment',
];
async function enqueueFoundationBatch() {
    logger_1.logger.info('🎗️  Starting Foundation Batch Enqueue');
    logger_1.logger.info(`Auto-refresh token enabled: ${config_1.config.scraper.autoRefreshToken}`);
    try {
        let successCount = 0;
        let failCount = 0;
        for (const term of FOUNDATION_TERMS) {
            try {
                const job = await scraper_queue_1.scraperQueue.add('scrape-properties', {
                    searchTerm: term,
                    userId: 'foundation-batch-enqueue',
                    scheduled: true,
                }, {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000,
                    },
                    priority: 3,
                    removeOnComplete: 100,
                    removeOnFail: 50,
                });
                successCount++;
                logger_1.logger.info(`✅ [${successCount}/${FOUNDATION_TERMS.length}] Queued: "${term}" (Job ID: ${job.id})`);
            }
            catch (error) {
                failCount++;
                logger_1.logger.error(`❌ Failed to queue "${term}":`, error);
            }
        }
        logger_1.logger.info(`\n📊 Summary: ${successCount} queued, ${failCount} failed`);
        logger_1.logger.info('✨ Foundation batch enqueue completed!');
    }
    catch (error) {
        logger_1.logger.error('❌ Fatal error:', error);
        process.exit(1);
    }
}
enqueueFoundationBatch()
    .then(() => process.exit(0))
    .catch((error) => {
    logger_1.logger.error('❌ Script failed:', error);
    process.exit(1);
});
//# sourceMappingURL=enqueue-foundation-batch.js.map