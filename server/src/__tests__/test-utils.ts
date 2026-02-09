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
	const redis = new Redis({
		host: config.redis.host,
		port: config.redis.port,
		password: config.redis.password,
		maxRetriesPerRequest: 1,
		retryStrategy: () => null, // Don't retry, fail fast
		connectTimeout: timeoutMs,
		lazyConnect: true, // Don't connect immediately
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
 * Skip test if Redis is not available
 * Usage: await skipIfRedisUnavailable()
 */
export async function skipIfRedisUnavailable(): Promise<void> {
	const available = await isRedisAvailable();
	if (!available) {
		logger.debug(
			`⏭️  Skipping test: Redis not available at ${config.redis.host}:${config.redis.port}`,
		);
		// Vitest doesn't have a programmatic skip, but we can throw to exit
		throw new Error("SKIP_TEST_REDIS_UNAVAILABLE");
	}
}

/**
 * Check if database is available and responsive
 * Returns true if database can be connected to, false otherwise
 * Requires Tailscale VPN for remote database access
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
 * Skip test if database is not available
 * This checks if the DATABASE_URL is set and accessible
 */
export async function skipIfDatabaseUnavailable(): Promise<void> {
	if (!process.env.DATABASE_URL) {
		logger.debug("⏭️  Skipping test: DATABASE_URL not configured");
		throw new Error("SKIP_TEST_DATABASE_UNAVAILABLE");
	}

	const available = await isDatabaseAvailable();
	if (!available) {
		logger.debug(
			"⏭️  Skipping test: Database not reachable (Tailscale VPN may be required)",
		);
		throw new Error("SKIP_TEST_DATABASE_UNREACHABLE");
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
 * Check if Tailscale VPN is connected
 * Required for remote database and Redis on hobbes
 */
export function isTailscaleConnected(): boolean {
	// Simple heuristic: if DATABASE_URL contains a Tailscale-like IP (100.x.x.x)
	// or hostname, assume Tailscale might be needed
	const dbUrl = process.env.DATABASE_URL || "";
	const redisHost = config.redis.host;

	// Check if we're trying to connect to Tailscale network ranges
	const tailscalePattern = /100\.\d{1,3}\.\d{1,3}\.\d{1,3}/;
	const hostnamesRequiringTailscale = ["hobbes"];

	return (
		tailscalePattern.test(dbUrl) ||
		tailscalePattern.test(redisHost) ||
		hostnamesRequiringTailscale.some(
			(host) => dbUrl.includes(host) || redisHost.includes(host),
		)
	);
}
