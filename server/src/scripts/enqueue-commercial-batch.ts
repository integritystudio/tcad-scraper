#!/usr/bin/env node
/**
 * Enqueue Commercial Property Searches
 * Queues commercial property-related search terms
 */

import logger from '../lib/logger';
import { enqueueBatchGeneric } from './utils/batch-enqueue';

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
  return enqueueBatchGeneric({
    batchName: 'Commercial',
    emoji: '🏢',
    terms: COMMERCIAL_TERMS,
    userId: 'commercial-batch-enqueue',
  });
}

enqueueCommercialBatch()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error({ err: error }, '❌ Script failed:');
    process.exit(1);
  });
