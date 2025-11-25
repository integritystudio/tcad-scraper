#!/usr/bin/env node
"use strict";
/**
 * Enqueue Partnership Property Searches
 * Queues partnership and association search terms
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = __importDefault(require("../lib/logger"));
const batch_enqueue_1 = require("./utils/batch-enqueue");
const PARTNERSHIP_TERMS = [
    'Partnership',
    'Partners',
    'Part',
    'LP',
    'LLP',
    'Association',
    'Associates',
    'Assoc',
    'Assoc.',
    'Joint Venture',
];
async function enqueuePartnershipBatch() {
    return (0, batch_enqueue_1.enqueueBatchGeneric)({
        batchName: 'Partnership',
        emoji: '🤝',
        terms: PARTNERSHIP_TERMS,
        userId: 'partnership-batch-enqueue',
    });
}
enqueuePartnershipBatch()
    .then(() => process.exit(0))
    .catch((error) => {
    logger_1.default.error({ err: error }, '❌ Script failed:');
    process.exit(1);
});
//# sourceMappingURL=enqueue-partnership-batch.js.map