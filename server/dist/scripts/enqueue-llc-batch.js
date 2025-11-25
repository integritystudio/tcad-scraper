#!/usr/bin/env node
"use strict";
/**
 * Enqueue LLC Property Searches
 * Queues LLC and limited company search terms
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = __importDefault(require("../lib/logger"));
const batch_enqueue_1 = require("./utils/batch-enqueue");
const LLC_TERMS = [
    'LLC',
    'LLC.',
    'L.L.C.',
    'Limited Liability',
    'Limited',
    'LMTD',
    'Limit',
    'L L C',
    'LTD',
    'Co LLC',
];
async function enqueueLLCBatch() {
    return (0, batch_enqueue_1.enqueueBatchGeneric)({
        batchName: 'LLC',
        emoji: '🏭',
        terms: LLC_TERMS,
        userId: 'llc-batch-enqueue',
    });
}
enqueueLLCBatch()
    .then(() => process.exit(0))
    .catch((error) => {
    logger_1.default.error({ err: error }, '❌ Script failed:');
    process.exit(1);
});
//# sourceMappingURL=enqueue-llc-batch.js.map