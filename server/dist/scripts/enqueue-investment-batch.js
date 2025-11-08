#!/usr/bin/env node
"use strict";
/**
 * Enqueue Investment Property Searches
 * Queues investment and management search terms
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const scraper_queue_1 = require("../queues/scraper.queue");
const logger_1 = __importDefault(require("../lib/logger"));
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
    logger_1.default.info('💰 Starting Investment Batch Enqueue');
    logger_1.default.info(`Auto-refresh token enabled: ${config_1.config.scraper.autoRefreshToken}`);
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
                logger_1.default.info(`✅ [${successCount}/${INVESTMENT_TERMS.length}] Queued: "${term}" (Job ID: ${job.id})`);
            }
            catch (error) {
                failCount++;
                logger_1.default.error({ err: error }, `❌ Failed to queue "${term}":`);
            }
        }
        logger_1.default.info(`\n📊 Summary: ${successCount} queued, ${failCount} failed`);
        logger_1.default.info('✨ Investment batch enqueue completed!');
    }
    catch (error) {
        logger_1.default.error({ err: error }, '❌ Fatal error:');
        process.exit(1);
    }
}
enqueueInvestmentBatch()
    .then(() => process.exit(0))
    .catch((error) => {
    logger_1.default.error({ err: error }, '❌ Script failed:');
    process.exit(1);
});
//# sourceMappingURL=enqueue-investment-batch.js.map