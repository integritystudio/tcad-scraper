/**
 * Jest Configuration for Unit Tests
 *
 * Unit tests should be isolated and not require external services.
 * They should use mocks for database, Redis, and external APIs.
 *
 * Run with: npm test
 *
 * For integration tests, use: npm run test:integration
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],

  // Match unit tests only (exclude integration tests)
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts',
  ],

  // Exclude integration tests
  testPathIgnorePatterns: [
    '/node_modules/',
    '\\.integration\\.test\\.ts$',
    '/src/__tests__/integration\\.test\\.ts$',
    '/src/__tests__/enqueue\\.test\\.ts$',
    '/src/__tests__/api\\.test\\.ts$',
    '/src/__tests__/auth-database\\.connection\\.test\\.ts$',
    '/src/routes/__tests__/',
    '/src/__tests__/security\\.test\\.ts$',
  ],

  transform: {
    '^.+\\.ts$': ['ts-jest', {
      isolatedModules: true,
    }],
  },

  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/*.integration.test.ts',
    '!src/index.ts',
    '!src/scripts/**',
    '!src/cli/**',
  ],

  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],

  // Unit tests should be fast
  testTimeout: 10000, // 10 seconds

  detectOpenHandles: true,
  forceExit: true,
  maxWorkers: 'auto', // Unit tests can run in parallel

  // Clear all mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
