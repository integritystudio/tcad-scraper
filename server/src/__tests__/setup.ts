/**
 * Vitest Setup File
 *
 * This file runs before all tests to configure the test environment
 */

import path from "node:path";
import dotenv from "dotenv";
import { afterAll } from "vitest";

// Load .env file from server directory
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent"; // Suppress all log output during tests

// Disable Sentry in tests
process.env.SENTRY_DSN = "";
process.env.SENTRY_ENABLED = "false";

// Auth config - real config will read these
process.env.JWT_SECRET = "test-jwt-secret";
process.env.JWT_EXPIRES_IN = "1h";
process.env.API_KEY = "test-api-key";
process.env.AUTH_SKIP_IN_DEVELOPMENT = "false";

// Mock API keys
process.env.CLAUDE_API_KEY = "test-claude-key";
process.env.ANTHROPIC_API_KEY = "test-anthropic-api-key";
process.env.TCAD_API_KEY = "test-tcad-key";

// Mock environment variables if needed
if (!process.env.REDIS_HOST) {
	process.env.REDIS_HOST = "localhost";
}

if (!process.env.REDIS_PORT) {
	process.env.REDIS_PORT = "6379";
}

// Set database URL for tests (use existing or default to local test DB)
if (!process.env.DATABASE_URL) {
	process.env.DATABASE_URL =
		"postgresql://postgres:postgres@localhost:5432/tcad_scraper_test";
}

if (!process.env.DATABASE_READ_ONLY_URL) {
	process.env.DATABASE_READ_ONLY_URL = process.env.DATABASE_URL;
}

// Set minimal defaults only if not already set
// Individual tests can override these
if (!process.env.PORT) {
	process.env.PORT = "3000";
}

// Global test cleanup
afterAll(async () => {
	// No-op: cleanup handled by individual test suites
});
