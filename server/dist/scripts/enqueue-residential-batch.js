#!/usr/bin/env node
"use strict";
/**
 * Enqueue Residential Property Searches
 * Queues common residential property search terms
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = __importDefault(require("../lib/logger"));
const config_1 = require("../config");
const batch_enqueue_1 = require("./utils/batch-enqueue");
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
    return (0, batch_enqueue_1.enqueueBatchGeneric)({
        batchName: 'Residential',
        emoji: '🏠',
        terms: RESIDENTIAL_TERMS,
        userId: 'residential-batch-enqueue',
        extraLogs: () => {
            logger_1.default.info(`Token refresh interval: ${config_1.config.scraper.tokenRefreshInterval}ms`);
        },
    });
}
enqueueResidentialBatch()
    .then(() => process.exit(0))
    .catch((error) => {
    logger_1.default.error({ err: error }, '❌ Script failed:');
    process.exit(1);
});
//# sourceMappingURL=enqueue-residential-batch.js.map