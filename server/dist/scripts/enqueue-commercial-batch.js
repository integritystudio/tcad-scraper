#!/usr/bin/env node
"use strict";
/**
 * Enqueue Commercial Property Searches
 * Queues commercial property-related search terms
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const scraper_queue_1 = require("../queues/scraper.queue");
const logger_1 = __importDefault(require("../lib/logger"));
const config_1 = require("../config");
const COMMERCIAL_TERMS = [
    'Shopping',
    'Retail',
    'Office',
    'Warehouse',
    'Industrial',
    'Commercial',
    'Business',
    'Store',
    'Mall',
    'Building',
];
async function enqueueCommercialBatch() {
    logger_1.default.info('🏢 Starting Commercial Batch Enqueue');
    logger_1.default.info(`Auto-refresh token enabled: ${config_1.config.scraper.autoRefreshToken}`);
    logger_1.default.info(`Using Doppler: ${config_1.config.doppler.enabled ? 'Yes' : 'No'}`);
    try {
        let successCount = 0;
        let failCount = 0;
        for (const term of COMMERCIAL_TERMS) {
            try {
                const job = await scraper_queue_1.scraperQueue.add('scrape-properties', {
                    searchTerm: term,
                    userId: 'commercial-batch-enqueue',
                    scheduled: true,
                }, {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000,
                    },
                    priority: 2, // Higher priority for commercial
                    removeOnComplete: 100,
                    removeOnFail: 50,
                });
                successCount++;
                logger_1.default.info(`✅ [${successCount}/${COMMERCIAL_TERMS.length}] Queued: "${term}" (Job ID: ${job.id})`);
            }
            catch (error) {
                failCount++;
                logger_1.default.error({ err: error }, `❌ Failed to queue "${term}":`);
            }
        }
        logger_1.default.info(`\n📊 Summary: ${successCount} queued, ${failCount} failed`);
        logger_1.default.info('✨ Commercial batch enqueue completed!');
    }
    catch (error) {
        logger_1.default.error({ err: error }, '❌ Fatal error:');
        process.exit(1);
    }
}
enqueueCommercialBatch()
    .then(() => process.exit(0))
    .catch((error) => {
    logger_1.default.error({ err: error }, '❌ Script failed:');
    process.exit(1);
});
//# sourceMappingURL=enqueue-commercial-batch.js.map