/**
 * Jest Setup File
 *
 * This file runs before all tests to configure the test environment
 */

import { jest } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Mock environment variables if needed
if (!process.env.REDIS_HOST) {
  process.env.REDIS_HOST = 'localhost';
}

if (!process.env.REDIS_PORT) {
  process.env.REDIS_PORT = '6379';
}

// Set database URL for tests (use existing or default to local)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/tcad_scraper';
}

if (!process.env.DATABASE_READ_ONLY_URL) {
  process.env.DATABASE_READ_ONLY_URL = process.env.DATABASE_URL;
}

// Increase timeout for slower operations
jest.setTimeout(30000);
