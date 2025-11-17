/**
 * Vitest Configuration for Unit Tests
 *
 * Unit tests should be isolated and not require external services.
 * They should use mocks for database, Redis, and external APIs.
 *
 * Run with: npm test
 *
 * For integration tests, see vitest.integration.config.ts
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',

    // Setup file
    setupFiles: ['./src/__tests__/setup.ts'],

    // Match unit tests only (exclude integration tests)
    include: [
      'src/**/__tests__/**/*.test.ts',
      'src/**/*.test.ts',
      'src/**/*.spec.ts',
    ],

    // Exclude integration tests
    exclude: [
      '**/node_modules/**',
      '**/*.integration.test.ts',
      'src/__tests__/integration.test.ts',
      'src/__tests__/enqueue.test.ts',
      'src/__tests__/api.test.ts',
      'src/__tests__/auth-database.connection.test.ts',
      'src/__tests__/security.test.ts',
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/**/*.ts',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/**/__tests__/**',
        'src/**/*.integration.test.ts',
        'src/index.ts',
        'src/scripts/**',
        'src/cli/**',
      ],
      thresholds: {
        statements: 35,
        branches: 32,
        functions: 37,
        lines: 35,
      },
    },

    // Unit tests should be fast
    testTimeout: 10000, // 10 seconds

    // Clear all mocks between tests
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,

    // Parallel execution for unit tests
    threads: true,

    // Detect hanging tests
    hookTimeout: 30000,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
