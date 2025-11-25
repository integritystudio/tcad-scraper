/**
 * Vitest Setup File
 *
 * This file runs before all tests to configure the test environment
 */

import { afterAll } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Disable Sentry in tests
process.env.SENTRY_DSN = '';
process.env.SENTRY_ENABLED = 'false';

// Mock API keys
process.env.CLAUDE_API_KEY = 'test-claude-key';
process.env.TCAD_API_KEY = 'test-tcad-key';

// Mock environment variables if needed
if (!process.env.REDIS_HOST) {
  process.env.REDIS_HOST = 'localhost';
}

if (!process.env.REDIS_PORT) {
  process.env.REDIS_PORT = '6379';
}

// Set database URL for tests (use existing or default to local test DB)
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/tcad_scraper_test';
}

if (!process.env.DATABASE_READ_ONLY_URL) {
  process.env.DATABASE_READ_ONLY_URL = process.env.DATABASE_URL;
}

// Set minimal defaults only if not already set
// Individual tests can override these
if (!process.env.PORT) {
  process.env.PORT = '3000';
}

// Global test cleanup
afterAll(async () => {
  // Give time for async operations to complete
  await new Promise(resolve => setTimeout(resolve, 500));
});
