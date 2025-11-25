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
const logger_1 = __importDefault(require("../lib/logger"));
const batch_enqueue_1 = require("./utils/batch-enqueue");
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
    return (0, batch_enqueue_1.enqueueBatchGeneric)({
        batchName: 'Commercial',
        emoji: '🏢',
        terms: COMMERCIAL_TERMS,
        userId: 'commercial-batch-enqueue',
    });
}
enqueueCommercialBatch()
    .then(() => process.exit(0))
    .catch((error) => {
    logger_1.default.error({ err: error }, '❌ Script failed:');
    process.exit(1);
});
//# sourceMappingURL=enqueue-commercial-batch.js.map