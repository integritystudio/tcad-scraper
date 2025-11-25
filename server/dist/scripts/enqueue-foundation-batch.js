#!/usr/bin/env node
"use strict";
/**
 * Enqueue Foundation & Nonprofit Searches
 * Queues foundation, nonprofit, and charitable organization search terms
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = __importDefault(require("../lib/logger"));
const batch_enqueue_1 = require("./utils/batch-enqueue");
const FOUNDATION_TERMS = [
    'Foundation',
    'Charitable',
    'Charity',
    'Nonprofit',
    'Non-Profit',
    'Organization',
    'Institute',
    'Society',
    'Association',
    'Endowment',
];
async function enqueueFoundationBatch() {
    return (0, batch_enqueue_1.enqueueBatchGeneric)({
        batchName: 'Foundation',
        emoji: '🎗️',
        terms: FOUNDATION_TERMS,
        userId: 'foundation-batch-enqueue',
    });
}
enqueueFoundationBatch()
    .then(() => process.exit(0))
    .catch((error) => {
    logger_1.default.error({ err: error }, '❌ Script failed:');
    process.exit(1);
});
//# sourceMappingURL=enqueue-foundation-batch.js.map