#!/usr/bin/env node
"use strict";
/**
 * Enqueue Construction & Building Searches
 * Queues construction and building-related search terms
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = __importDefault(require("../lib/logger"));
const batch_enqueue_1 = require("./utils/batch-enqueue");
const CONSTRUCTION_TERMS = [
    'Construction',
    'Builders',
    'Builder',
    'Contractor',
    'Contracting',
    'Homes',
    'Home',
    'Custom Homes',
    'Housing',
    'Residential Builders',
];
async function enqueueConstructionBatch() {
    return (0, batch_enqueue_1.enqueueBatchGeneric)({
        batchName: 'Construction',
        emoji: '🏗️',
        terms: CONSTRUCTION_TERMS,
        userId: 'construction-batch-enqueue',
    });
}
enqueueConstructionBatch()
    .then(() => process.exit(0))
    .catch((error) => {
    logger_1.default.error({ err: error }, '❌ Script failed:');
    process.exit(1);
});
//# sourceMappingURL=enqueue-construction-batch.js.map