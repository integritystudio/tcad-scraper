#!/usr/bin/env ts-node

/**
 * Test script for TCAD Token Auto-Refresh Service
 *
 * This script tests:
 * 1. Manual token refresh
 * 2. Token retrieval
 * 3. Service statistics
 * 4. Auto-refresh scheduling
 */

import { config } from "../config";
import logger from "../lib/logger";
import { tokenRefreshService } from "../services/token-refresh.service";

logger.info("=== TCAD Token Auto-Refresh Service Test ===\n");

async function testTokenRefresh() {
	logger.info("Configuration:");
	logger.info("--------------");
	logger.info(`Auto-Refresh Enabled: ${config.scraper.autoRefreshToken}`);
	logger.info(
		`Refresh Interval: ${config.scraper.tokenRefreshInterval}ms (${config.scraper.tokenRefreshInterval / 60000} minutes)`,
	);
	logger.info(
		`Cron Schedule: ${config.scraper.tokenRefreshCron || "Not set (using interval)"}`,
	);
	logger.info("");

	// Test 1: Check initial state
	logger.info("Test 1: Initial State");
	logger.info("---------------------");
	const initialStats = tokenRefreshService.getStats();
	logger.info(`Current Token: ${initialStats.currentToken || "None"}`);
	logger.info(`Last Refresh: ${initialStats.lastRefreshTime || "Never"}`);
	logger.info(`Refresh Count: ${initialStats.refreshCount}`);
	logger.info(`Failure Count: ${initialStats.failureCount}`);
	logger.info(`Is Running: ${initialStats.isRunning}`);
	logger.info("");

	// Test 2: Manual token refresh
	logger.info("Test 2: Manual Token Refresh");
	logger.info("-----------------------------");
	logger.info("⏳ Refreshing token (this may take 5-10 seconds)...");
	logger.info("");

	const startTime = Date.now();
	const token = await tokenRefreshService.refreshToken();
	const duration = Date.now() - startTime;

	logger.info("");
	if (token) {
		logger.info(`✅ Token refreshed successfully in ${duration}ms`);
		logger.info(`Token preview: ...${token.slice(-4)}`);
	} else {
		logger.info(`❌ Token refresh failed`);
	}
	logger.info("");

	// Test 3: Check stats after refresh
	logger.info("Test 3: Statistics After Refresh");
	logger.info("---------------------------------");
	const statsAfterRefresh = tokenRefreshService.getStats();
	logger.info(`Current Token: ${statsAfterRefresh.currentToken || "None"}`);
	logger.info(`Last Refresh: ${statsAfterRefresh.lastRefreshTime}`);
	logger.info(`Refresh Count: ${statsAfterRefresh.refreshCount}`);
	logger.info(`Failure Count: ${statsAfterRefresh.failureCount}`);
	logger.info("");

	// Test 4: Health check
	logger.info("Test 4: Health Check");
	logger.info("--------------------");
	const health = tokenRefreshService.getHealth();
	logger.info(`Healthy: ${health.healthy ? "✅" : "❌"}`);
	logger.info(`Has Token: ${health.hasToken ? "✅" : "❌"}`);
	logger.info(
		`Time Since Last Refresh: ${health.timeSinceLastRefresh ? `${health.timeSinceLastRefresh}ms` : "N/A"}`,
	);
	logger.info(`Failure Rate: ${health.failureRate}`);
	logger.info(
		`Auto-Refresh Running: ${health.isAutoRefreshRunning ? "✅" : "❌"}`,
	);
	logger.info("");

	// Test 5: Demo auto-refresh (run for 30 seconds)
	if (config.scraper.autoRefreshToken) {
		logger.info("Test 5: Auto-Refresh Demo");
		logger.info("-------------------------");
		logger.info("⏳ Starting auto-refresh service for 30 seconds...");
		logger.info("   (In production, this runs continuously)");
		logger.info("");

		// Start auto-refresh with a short interval for demo (30 seconds)
		tokenRefreshService.startAutoRefreshInterval(30000); // 30 seconds for demo

		logger.info("Service started. Waiting for first scheduled refresh...");
		logger.info("(Press Ctrl+C to stop early)");
		logger.info("");

		// Wait 35 seconds to see at least one refresh
		await new Promise((resolve) => setTimeout(resolve, 35000));

		// Stop auto-refresh
		tokenRefreshService.stopAutoRefresh();
		logger.info("");
		logger.info("Auto-refresh stopped.");
		logger.info("");

		// Show final stats
		const finalStats = tokenRefreshService.getStats();
		logger.info("Final Statistics:");
		logger.info(`  Total Refreshes: ${finalStats.refreshCount}`);
		logger.info(`  Total Failures: ${finalStats.failureCount}`);
		logger.info(`  Last Refresh: ${finalStats.lastRefreshTime}`);
		logger.info("");
	} else {
		logger.info("Test 5: Auto-Refresh Demo");
		logger.info("-------------------------");
		logger.info("⚠️  Auto-refresh is disabled in configuration");
		logger.info("   Set TCAD_AUTO_REFRESH_TOKEN=true to enable");
		logger.info("");
	}

	// Cleanup
	logger.info("Cleaning up...");
	await tokenRefreshService.cleanup();
	logger.info("✅ Cleanup complete");
	logger.info("");

	// Summary
	logger.info("=== Summary ===");
	logger.info("");

	const finalHealth = tokenRefreshService.getHealth();
	if (finalHealth.healthy) {
		logger.info("✅ Token refresh service is working correctly");
		logger.info("");
		logger.info("Production Usage:");
		logger.info("  1. Service starts automatically with server");
		logger.info(
			`  2. Refreshes token every ${config.scraper.tokenRefreshInterval / 60000} minutes`,
		);
		logger.info("  3. Scraper uses refreshed token automatically");
		logger.info("  4. Check health: GET /health/token");
		logger.info("");
		logger.info("Next Steps:");
		logger.info("  • Start server: npm run dev");
		logger.info('  • Monitor logs for "Token refreshed successfully"');
		logger.info(
			"  • Check health endpoint: curl http://localhost:3001/health/token",
		);
	} else {
		logger.info("⚠️  Token refresh encountered issues");
		logger.info("");
		logger.info("Troubleshooting:");
		logger.info("  • Check browser executable path");
		logger.info("  • Verify TCAD website is accessible");
		logger.info("  • Review error logs above");
	}
}

// Run the test
testTokenRefresh()
	.then(() => {
		logger.info("");
		logger.info("Test complete!");
		process.exit(0);
	})
	.catch((error) => {
		logger.error("");
		logger.error("Test failed:", error);
		process.exit(1);
	});
