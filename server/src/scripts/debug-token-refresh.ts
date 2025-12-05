#!/usr/bin/env node

/**
 * Debug Token Refresh
 * Tests the token refresh service and prints detailed diagnostics
 */

import logger from "../lib/logger";
import { tokenRefreshService } from "../services/token-refresh.service";

async function debugTokenRefresh() {
	logger.info("=".repeat(60));
	logger.info("DEBUG: Token Refresh Service");
	logger.info("=".repeat(60));

	// Check initial state
	logger.info("\n1. Initial State:");
	const initialToken = tokenRefreshService.getCurrentToken();
	logger.info(`   currentToken: ${initialToken ? `...${initialToken.slice(-4)}` : "null"}`);

	const initialStats = tokenRefreshService.getStats();
	logger.info(`   Stats: ${JSON.stringify(initialStats, null, 2)}`);

	// Try to refresh token
	logger.info("\n2. Calling refreshToken()...");
	const startTime = Date.now();

	try {
		const token = await tokenRefreshService.refreshToken();
		const duration = Date.now() - startTime;

		logger.info(`\n3. refreshToken() returned after ${duration}ms:`);
		logger.info(`   Type: ${typeof token}`);
		logger.info(`   Value: [REDACTED]...${token ? token.slice(-4) : "N/A"}`);
		logger.info(`   Length: ${token ? token.length : "N/A"}`);
	} catch (error) {
		logger.error(
			`\n3. refreshToken() threw error: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	// Check state after refresh
	logger.info("\n4. State After Refresh:");
	const refreshedToken = tokenRefreshService.getCurrentToken();
	logger.info(`   currentToken: ${refreshedToken ? `...${refreshedToken.slice(-4)}` : "null"}`);

	const afterStats = tokenRefreshService.getStats();
	logger.info(`   Stats: ${JSON.stringify(afterStats, null, 2)}`);

	// Test getCurrentToken multiple times
	logger.info("\n5. Multiple getCurrentToken() calls:");
	for (let i = 0; i < 3; i++) {
		const token = tokenRefreshService.getCurrentToken();
		logger.info(`   Call ${i + 1}: ${token ? `...${token.slice(-4)}` : "null"}`);
	}

	// Cleanup
	logger.info("\n6. Cleaning up...");
	await tokenRefreshService.cleanup();

	logger.info(`\n${"=".repeat(60)}`);
	logger.info("DEBUG: Complete");
	logger.info("=".repeat(60));
}

debugTokenRefresh()
	.then(() => process.exit(0))
	.catch((error) => {
		logger.error("Script failed:", error);
		process.exit(1);
	});
