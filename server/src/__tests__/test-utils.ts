/**
 * Test Utilities
 *
 * Helper functions for integration tests to handle infrastructure dependencies
 */

import fs from "node:fs";
import path from "node:path";
import Redis from "ioredis";
import { config } from "../config";
import logger from "../lib/logger";

/**
 * Check if Redis is available and responsive
 * Returns true if Redis can be pinged within timeout, false otherwise
 */
export async function isRedisAvailable(
	timeoutMs: number = 2000,
): Promise<boolean> {
	const redis = config.redis.url
		? new Redis(config.redis.url, {
				...(config.redis.url.startsWith("rediss:") ? { tls: {} } : {}),
				maxRetriesPerRequest: 1,
				retryStrategy: () => null,
				connectTimeout: timeoutMs,
				lazyConnect: true,
			})
		: new Redis({
				host: config.redis.host,
				port: config.redis.port,
				password: config.redis.password,
				maxRetriesPerRequest: 1,
				retryStrategy: () => null,
				connectTimeout: timeoutMs,
				lazyConnect: true,
			});

	try {
		await redis.connect();
		await Promise.race([
			redis.ping(),
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error("Ping timeout")), timeoutMs),
			),
		]);
		await redis.quit();
		return true;
	} catch (_error) {
		try {
			await redis.disconnect();
		} catch {
			// Ignore disconnect errors
		}
		return false;
	}
}

/**
 * Check if database is available and responsive
 * Returns true if database can be connected to, false otherwise
 * Requires remote database access
 */
export async function isDatabaseAvailable(
	timeoutMs: number = 5000,
): Promise<boolean> {
	if (!process.env.DATABASE_URL) {
		return false;
	}

	try {
		// Dynamic import to avoid loading prisma in tests that don't need it
		const { prisma } = await import("../lib/prisma");

		// Race between connection attempt and timeout
		await Promise.race([
			prisma.$connect(),
			new Promise((_, reject) =>
				setTimeout(
					() => reject(new Error("Database connection timeout")),
					timeoutMs,
				),
			),
		]);

		await prisma.$disconnect();
		return true;
	} catch (_error) {
		return false;
	}
}

/**
 * Conditional test runner that skips if Redis is unavailable
 *
 * Usage:
 * testWithRedis('should do something', async () => {
 *   // test code
 * });
 */
export function testWithRedis(
	name: string,
	fn: () => void | Promise<void>,
	_testTimeout?: number,
) {
	return async () => {
		const available = await isRedisAvailable();
		if (!available) {
			logger.debug(`⏭️  Skipping "${name}": Redis not available`);
			return;
		}
		return fn();
	};
}

/**
 * Check if frontend build files are available
 * Required for tests that verify SPA routing behavior
 *
 * The frontend build must be in one of these locations:
 * - server/public/index.html (Express static serving)
 * - frontend/dist/index.html (Vite build output, needs copying)
 */
export function isFrontendBuilt(): boolean {
	// Check for frontend build in Express's public directory (what Express actually serves)
	// The test should only pass if the frontend is properly configured for Express to serve
	const possiblePaths = [
		// Primary: Express public directory (server needs frontend copied here)
		path.join(__dirname, "../../public/index.html"),
		// Alternative: frontend build output (may need to be linked/copied)
		path.join(__dirname, "../../../frontend/dist/index.html"),
	];

	const found = possiblePaths.some((p) => {
		try {
			return fs.existsSync(p);
		} catch {
			return false;
		}
	});

	return found;
}

/**
 * Assert that a response status matches one of the expected statuses.
 *
 * Used for endpoints where auth enforcement varies by environment —
 * e.g. scrape/monitor return 200 without auth and 401 with it (TC-17).
 *
 * @example
 * expectStatusIn(response, [200, 401]);
 */
export function expectStatusIn(
	response: { status: number },
	statuses: number[],
): void {
	if (!statuses.includes(response.status)) {
		throw new Error(
			`Expected response status to be one of [${statuses.join(", ")}] but got ${response.status}`,
		);
	}
}

/**
 * Check if remote database is configured
 * Required for integration tests against Render database
 */
export function isRemoteDatabaseConfigured(): boolean {
	const dbUrl = process.env.DATABASE_URL || "";
	return dbUrl.length > 0 && !dbUrl.includes("localhost");
}
