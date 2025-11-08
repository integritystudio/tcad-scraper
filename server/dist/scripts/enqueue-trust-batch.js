#!/usr/bin/env node
"use strict";
/**
 * Enqueue Trust & Estate Searches
 * Queues trust and estate-related search terms (high-yield searches)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const scraper_queue_1 = require("../queues/scraper.queue");
const logger_1 = __importDefault(require("../lib/logger"));
const config_1 = require("../config");
const TRUST_TERMS = [
    'Trust',
    'Trustee',
    'Estate',
    'Family Trust',
    'Revocable Trust',
    'Irrevocable Trust',
    'Living Trust',
    'Testamentary',
    'Fiduciary',
    'Beneficiary',
];
async function enqueueTrustBatch() {
    logger_1.default.info('📜 Starting Trust & Estate Batch Enqueue');
    logger_1.default.info(`Auto-refresh token enabled: ${config_1.config.scraper.autoRefreshToken}`);
    logger_1.default.info(`Expected high yield: ~70+ properties per term`);
    try {
        let successCount = 0;
        let failCount = 0;
        for (const term of TRUST_TERMS) {
            try {
                const job = await scraper_queue_1.scraperQueue.add('scrape-properties', {
                    searchTerm: term,
                    userId: 'trust-batch-enqueue',
                    scheduled: true,
                }, {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000,
                    },
                    priority: 1, // Highest priority - best yield
                    removeOnComplete: 100,
                    removeOnFail: 50,
                });
                successCount++;
                logger_1.default.info(`✅ [${successCount}/${TRUST_TERMS.length}] Queued: "${term}" (Job ID: ${job.id})`);
            }
            catch (error) {
                failCount++;
                logger_1.default.error({ err: error }, `❌ Failed to queue "${term}":`);
            }
        }
        logger_1.default.info(`\n📊 Summary: ${successCount} queued, ${failCount} failed`);
        logger_1.default.info(`📈 Estimated total properties: ${successCount * 70} (if all succeed)`);
        logger_1.default.info('✨ Trust batch enqueue completed!');
    }
    catch (error) {
        logger_1.default.error({ err: error }, '❌ Fatal error:');
        process.exit(1);
    }
}
enqueueTrustBatch()
    .then(() => process.exit(0))
    .catch((error) => {
    logger_1.default.error({ err: error }, '❌ Script failed:');
    process.exit(1);
});
//# sourceMappingURL=enqueue-trust-batch.js.map