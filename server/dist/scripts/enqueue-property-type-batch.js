#!/usr/bin/env node
"use strict";
/**
 * Enqueue Property Type Searches
 * Queues property type and real estate search terms
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = __importDefault(require("../lib/logger"));
const batch_enqueue_1 = require("./utils/batch-enqueue");
const PROPERTY_TYPE_TERMS = [
    'Properties',
    'Property',
    'Real Estate',
    'Realty',
    'Land',
    'Acres',
    'Development',
    'Developers',
    'Plaza',
    'Center',
];
async function enqueuePropertyTypeBatch() {
    return (0, batch_enqueue_1.enqueueBatchGeneric)({
        batchName: 'Property Type',
        emoji: '🏘️',
        terms: PROPERTY_TYPE_TERMS,
        userId: 'property-type-batch-enqueue',
    });
}
enqueuePropertyTypeBatch()
    .then(() => process.exit(0))
    .catch((error) => {
    logger_1.default.error({ err: error }, '❌ Script failed:');
    process.exit(1);
});
//# sourceMappingURL=enqueue-property-type-batch.js.map