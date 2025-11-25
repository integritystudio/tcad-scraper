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
const logger_1 = __importDefault(require("../lib/logger"));
const batch_enqueue_1 = require("./utils/batch-enqueue");
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
    return (0, batch_enqueue_1.enqueueBatchGeneric)({
        batchName: 'Trust & Estate',
        emoji: '📜',
        terms: TRUST_TERMS,
        userId: 'trust-batch-enqueue',
    });
}
enqueueTrustBatch()
    .then(() => process.exit(0))
    .catch((error) => {
    logger_1.default.error({ err: error }, '❌ Script failed:');
    process.exit(1);
});
//# sourceMappingURL=enqueue-trust-batch.js.map