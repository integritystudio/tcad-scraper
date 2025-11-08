/**
 * Jest Configuration for Integration Tests
 *
 * Integration tests require external services (PostgreSQL, Redis, etc.)
 * and test the system as a whole with real dependencies.
 *
 * Run with: npm run test:integration
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Only run integration tests
  testMatch: [
    '**/__tests__/**/*.integration.test.ts',
    '**/src/__tests__/integration.test.ts',
    '**/src/__tests__/enqueue.test.ts',
    '**/src/__tests__/api.test.ts',
    '**/src/__tests__/auth-database.connection.test.ts',
    '**/src/routes/__tests__/*.test.ts',
    '**/src/__tests__/security.test.ts',
  ],

  // TypeScript transformation
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      isolatedModules: true,
    }],
  },

  // Module paths
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Setup file
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],

  // Coverage
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.integration.test.ts',
    '!src/index.ts',
    '!src/scripts/**',
    '!src/cli/**',
    '!src/__tests__/**',
  ],

  coverageDirectory: 'coverage/integration',
  coverageReporters: ['text', 'lcov', 'html'],

  // Stability settings
  detectOpenHandles: true,
  forceExit: true,
  maxWorkers: 1, // Integration tests should run serially

  // Timeouts (integration tests can be slow)
  testTimeout: 30000, // 30 seconds

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: false,
  restoreMocks: false,

  // Verbose output
  verbose: true,
};
