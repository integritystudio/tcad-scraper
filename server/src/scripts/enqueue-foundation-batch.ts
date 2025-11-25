#!/usr/bin/env node
/**
 * Enqueue Foundation & Nonprofit Searches
 * Queues foundation, nonprofit, and charitable organization search terms
 */

import logger from '../lib/logger';
import { enqueueBatchGeneric } from './utils/batch-enqueue';

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
  return enqueueBatchGeneric({
    batchName: 'Foundation',
    emoji: '🎗️',
    terms: FOUNDATION_TERMS,
    userId: 'foundation-batch-enqueue',
  });
}

enqueueFoundationBatch()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error({ err: error }, '❌ Script failed:');
    process.exit(1);
  });
