#!/usr/bin/env node
"use strict";
/**
 * Enqueue Corporation Property Searches
 * Queues corporation-related search terms
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = __importDefault(require("../lib/logger"));
const batch_enqueue_1 = require("./utils/batch-enqueue");
const CORPORATION_TERMS = [
    'Corp',
    'Corp.',
    'Corporation',
    'Incorporated',
    'Inc',
    'Inc.',
    'Company',
    'Co.',
    'Enterprise',
    'Enterprises',
];
async function enqueueCorporationBatch() {
    return (0, batch_enqueue_1.enqueueBatchGeneric)({
        batchName: 'Corporation',
        emoji: '🏛️',
        terms: CORPORATION_TERMS,
        userId: 'corporation-batch-enqueue',
        priority: 2,
    });
}
enqueueCorporationBatch()
    .then(() => process.exit(0))
    .catch((error) => {
    logger_1.default.error({ err: error }, '❌ Script failed:');
    process.exit(1);
});
//# sourceMappingURL=enqueue-corporation-batch.js.map