#!/usr/bin/env node
/**
 * Enqueue Trust & Estate Searches
 * Queues trust and estate-related search terms (high-yield searches)
 */

import logger from '../lib/logger';
import { enqueueBatchGeneric } from './utils/batch-enqueue';

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
  return enqueueBatchGeneric({
    batchName: 'Trust & Estate',
    emoji: '📜',
    terms: TRUST_TERMS,
    userId: 'trust-batch-enqueue',
  });
}

enqueueTrustBatch()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error({ err: error }, '❌ Script failed:');
    process.exit(1);
  });
