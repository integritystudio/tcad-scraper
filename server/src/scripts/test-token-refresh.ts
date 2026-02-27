#!/usr/bin/env ts-node

/**
 * Test script for TCAD Token Refresh Service
 *
 * Tests token retrieval, service statistics, and health check.
 * Token is managed externally via TCAD_API_KEY env var (Doppler).
 */

import { config } from "../config";
import logger from "../lib/logger";
import { tokenRefreshService } from "../services/token-refresh.service";

logger.info("=== TCAD Token Service Test ===\n");

async function testTokenRefresh() {
	logger.info("Configuration:");
	logger.info("--------------");
	logger.info(
		`TCAD API Token: ${config.scraper.tcadApiKey ? "configured" : "NOT configured"}`,
	);
	logger.info("");

	// Test 1: Check initial state
	logger.info("Test 1: Initial State");
	logger.info("---------------------");
	const initialStats = tokenRefreshService.getStats();
	logger.info(`Current Token: ${initialStats.currentToken || "None"}`);
	logger.info(`Last Refresh: ${initialStats.lastRefreshTime || "Never"}`);
	logger.info(`Success Count: ${initialStats.successCount}`);
	logger.info(`Failure Count: ${initialStats.failureCount}`);
	logger.info(`Is Running: ${initialStats.isRunning}`);
	logger.info("");

	// Test 2: Token refresh (returns env token)
	logger.info("Test 2: Token Refresh");
	logger.info("---------------------");
	const token = await tokenRefreshService.refreshToken();
	if (token) {
		logger.info(`Token available: ...${token.slice(-4)}`);
	} else {
		logger.info("No token available");
	}
	logger.info("");

	// Test 3: Health check
	logger.info("Test 3: Health Check");
	logger.info("--------------------");
	const health = tokenRefreshService.getHealth();
	logger.info(`Healthy: ${health.healthy}`);
	logger.info(`Has Token: ${health.hasToken}`);
	logger.info(`Failure Rate: ${health.failureRate}`);
	logger.info("");

	// Cleanup
	await tokenRefreshService.cleanup();

	// Summary
	logger.info("=== Summary ===");
	if (health.healthy) {
		logger.info("Token service is working correctly (env-token mode)");
	} else {
		logger.info("WARNING: No token configured. Set TCAD_API_KEY in Doppler.");
	}
}

testTokenRefresh()
	.then(() => {
		logger.info("\nTest complete!");
		process.exit(0);
	})
	.catch((error) => {
		logger.error("Test failed:", error);
		process.exit(1);
	});
