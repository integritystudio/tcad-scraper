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
const logger_1 = __importDefault(require("../lib/logger"));
const batch_enqueue_1 = require("./utils/batch-enqueue");
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
    return (0, batch_enqueue_1.enqueueBatchGeneric)({
        batchName: 'Investment',
        emoji: '💰',
        terms: INVESTMENT_TERMS,
        userId: 'investment-batch-enqueue',
    });
}
enqueueInvestmentBatch()
    .then(() => process.exit(0))
    .catch((error) => {
    logger_1.default.error({ err: error }, '❌ Script failed:');
    process.exit(1);
});
//# sourceMappingURL=enqueue-investment-batch.js.map