#!/usr/bin/env node
"use strict";
/**
 * Enqueue Investment Property Searches
 * Queues investment and management search terms
 */
Object.defineProperty(exports, "__esModule", { value: true });
const scraper_queue_1 = require("../queues/scraper.queue");
const logger_1 = require("../lib/logger");
const config_1 = require("../config");
const INVESTMENT_TERMS = [
    'Investments',
    'Holdings',
    'Capital',
    'Fund',
    'Equity',
    'Ventures',
    'Asset',
    'Portfolio',
    'Management',
    'Manage',
];
async function enqueueInvestmentBatch() {
    logger_1.logger.info('💰 Starting Investment Batch Enqueue');
    logger_1.logger.info(`Auto-refresh token enabled: ${config_1.config.scraper.autoRefreshToken}`);
    try {
        let successCount = 0;
        let failCount = 0;
        for (const term of INVESTMENT_TERMS) {
            try {
                const job = await scraper_queue_1.scraperQueue.add('scrape-properties', {
                    searchTerm: term,
                    userId: 'investment-batch-enqueue',
                    scheduled: true,
                }, {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000,
                    },
                    priority: 1, // High priority - likely high yield
                    removeOnComplete: 100,
                    removeOnFail: 50,
                });
                successCount++;
                logger_1.logger.info(`✅ [${successCount}/${INVESTMENT_TERMS.length}] Queued: "${term}" (Job ID: ${job.id})`);
            }
            catch (error) {
                failCount++;
                logger_1.logger.error(`❌ Failed to queue "${term}":`, error);
            }
        }
        logger_1.logger.info(`\n📊 Summary: ${successCount} queued, ${failCount} failed`);
        logger_1.logger.info('✨ Investment batch enqueue completed!');
    }
    catch (error) {
        logger_1.logger.error('❌ Fatal error:', error);
        process.exit(1);
    }
}
enqueueInvestmentBatch()
    .then(() => process.exit(0))
    .catch((error) => {
    logger_1.logger.error('❌ Script failed:', error);
    process.exit(1);
});
//# sourceMappingURL=enqueue-investment-batch.js.map