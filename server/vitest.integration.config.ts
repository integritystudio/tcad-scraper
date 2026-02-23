/**
 * Vitest Configuration for Integration Tests
 *
 * Integration tests require external services:
 * - PostgreSQL database (via Tailscale)
 * - Redis (for queue operations)
 * - Running Express server
 *
 * Prerequisites:
 * - Tailscale VPN must be running
 * - DATABASE_URL must be configured in .env
 * - Redis must be running (local or hobbes)
 *
 * Run with: npm run test:integration
 *
 * For unit tests, see vitest.config.ts
 */

import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Test environment
		environment: "node",

		// Setup file
		setupFiles: ["./src/__tests__/setup.ts"],

		// Match ONLY integration tests
		include: [
			"**/*.integration.test.ts",
			"src/__tests__/integration.test.ts",
			"src/__tests__/api.test.ts",
			"src/__tests__/auth-database.connection.test.ts",
			"src/__tests__/enqueue.test.ts",
			"src/__tests__/security.test.ts",
		],

		// Exclude everything else (except the integration tests above)
		exclude: ["**/node_modules/**", "src/**/dist/**", "src/**/build/**"],

		// Integration tests need longer timeouts
		testTimeout: 60000, // 60 seconds
		hookTimeout: 120000,

		// Run integration tests sequentially to avoid conflicts
		threads: false,
		maxConcurrency: 1,

		// Don't clear mocks between integration tests (some may share setup)
		clearMocks: false,
		mockReset: false,
		restoreMocks: false,

		// Retry failed integration tests to handle transient network issues
		retry: 2,

		// Bail on first failure (don't waste time if infra is down)
		bail: 1,

		// Coverage not typically needed for integration tests
		coverage: {
			enabled: false,
		},
	},

	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
