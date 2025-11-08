#!/usr/bin/env ts-node
"use strict";
/**
 * Test script for TCAD Token Auto-Refresh Service
 *
 * This script tests:
 * 1. Manual token refresh
 * 2. Token retrieval
 * 3. Service statistics
 * 4. Auto-refresh scheduling
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const token_refresh_service_1 = require("../services/token-refresh.service");
const config_1 = require("../config");
const logger_1 = __importDefault(require("../lib/logger"));
logger_1.default.info('=== TCAD Token Auto-Refresh Service Test ===\n');
async function testTokenRefresh() {
    logger_1.default.info('Configuration:');
    logger_1.default.info('--------------');
    logger_1.default.info(`Auto-Refresh Enabled: ${config_1.config.scraper.autoRefreshToken}`);
    logger_1.default.info(`Refresh Interval: ${config_1.config.scraper.tokenRefreshInterval}ms (${config_1.config.scraper.tokenRefreshInterval / 60000} minutes)`);
    logger_1.default.info(`Cron Schedule: ${config_1.config.scraper.tokenRefreshCron || 'Not set (using interval)'}`);
    logger_1.default.info('');
    // Test 1: Check initial state
    logger_1.default.info('Test 1: Initial State');
    logger_1.default.info('---------------------');
    const initialStats = token_refresh_service_1.tokenRefreshService.getStats();
    logger_1.default.info(`Current Token: ${initialStats.currentToken || 'None'}`);
    logger_1.default.info(`Last Refresh: ${initialStats.lastRefreshTime || 'Never'}`);
    logger_1.default.info(`Refresh Count: ${initialStats.refreshCount}`);
    logger_1.default.info(`Failure Count: ${initialStats.failureCount}`);
    logger_1.default.info(`Is Running: ${initialStats.isRunning}`);
    logger_1.default.info('');
    // Test 2: Manual token refresh
    logger_1.default.info('Test 2: Manual Token Refresh');
    logger_1.default.info('-----------------------------');
    logger_1.default.info('⏳ Refreshing token (this may take 5-10 seconds)...');
    logger_1.default.info('');
    const startTime = Date.now();
    const token = await token_refresh_service_1.tokenRefreshService.refreshToken();
    const duration = Date.now() - startTime;
    logger_1.default.info('');
    if (token) {
        logger_1.default.info(`✅ Token refreshed successfully in ${duration}ms`);
        logger_1.default.info(`Token preview: ${token.substring(0, 50)}...`);
    }
    else {
        logger_1.default.info(`❌ Token refresh failed`);
    }
    logger_1.default.info('');
    // Test 3: Check stats after refresh
    logger_1.default.info('Test 3: Statistics After Refresh');
    logger_1.default.info('---------------------------------');
    const statsAfterRefresh = token_refresh_service_1.tokenRefreshService.getStats();
    logger_1.default.info(`Current Token: ${statsAfterRefresh.currentToken || 'None'}`);
    logger_1.default.info(`Last Refresh: ${statsAfterRefresh.lastRefreshTime}`);
    logger_1.default.info(`Refresh Count: ${statsAfterRefresh.refreshCount}`);
    logger_1.default.info(`Failure Count: ${statsAfterRefresh.failureCount}`);
    logger_1.default.info('');
    // Test 4: Health check
    logger_1.default.info('Test 4: Health Check');
    logger_1.default.info('--------------------');
    const health = token_refresh_service_1.tokenRefreshService.getHealth();
    logger_1.default.info(`Healthy: ${health.healthy ? '✅' : '❌'}`);
    logger_1.default.info(`Has Token: ${health.hasToken ? '✅' : '❌'}`);
    logger_1.default.info(`Time Since Last Refresh: ${health.timeSinceLastRefresh ? `${health.timeSinceLastRefresh}ms` : 'N/A'}`);
    logger_1.default.info(`Failure Rate: ${health.failureRate}`);
    logger_1.default.info(`Auto-Refresh Running: ${health.isAutoRefreshRunning ? '✅' : '❌'}`);
    logger_1.default.info('');
    // Test 5: Demo auto-refresh (run for 30 seconds)
    if (config_1.config.scraper.autoRefreshToken) {
        logger_1.default.info('Test 5: Auto-Refresh Demo');
        logger_1.default.info('-------------------------');
        logger_1.default.info('⏳ Starting auto-refresh service for 30 seconds...');
        logger_1.default.info('   (In production, this runs continuously)');
        logger_1.default.info('');
        // Start auto-refresh with a short interval for demo (30 seconds)
        token_refresh_service_1.tokenRefreshService.startAutoRefreshInterval(30000); // 30 seconds for demo
        logger_1.default.info('Service started. Waiting for first scheduled refresh...');
        logger_1.default.info('(Press Ctrl+C to stop early)');
        logger_1.default.info('');
        // Wait 35 seconds to see at least one refresh
        await new Promise(resolve => setTimeout(resolve, 35000));
        // Stop auto-refresh
        token_refresh_service_1.tokenRefreshService.stopAutoRefresh();
        logger_1.default.info('');
        logger_1.default.info('Auto-refresh stopped.');
        logger_1.default.info('');
        // Show final stats
        const finalStats = token_refresh_service_1.tokenRefreshService.getStats();
        logger_1.default.info('Final Statistics:');
        logger_1.default.info(`  Total Refreshes: ${finalStats.refreshCount}`);
        logger_1.default.info(`  Total Failures: ${finalStats.failureCount}`);
        logger_1.default.info(`  Last Refresh: ${finalStats.lastRefreshTime}`);
        logger_1.default.info('');
    }
    else {
        logger_1.default.info('Test 5: Auto-Refresh Demo');
        logger_1.default.info('-------------------------');
        logger_1.default.info('⚠️  Auto-refresh is disabled in configuration');
        logger_1.default.info('   Set TCAD_AUTO_REFRESH_TOKEN=true to enable');
        logger_1.default.info('');
    }
    // Cleanup
    logger_1.default.info('Cleaning up...');
    await token_refresh_service_1.tokenRefreshService.cleanup();
    logger_1.default.info('✅ Cleanup complete');
    logger_1.default.info('');
    // Summary
    logger_1.default.info('=== Summary ===');
    logger_1.default.info('');
    const finalHealth = token_refresh_service_1.tokenRefreshService.getHealth();
    if (finalHealth.healthy) {
        logger_1.default.info('✅ Token refresh service is working correctly');
        logger_1.default.info('');
        logger_1.default.info('Production Usage:');
        logger_1.default.info('  1. Service starts automatically with server');
        logger_1.default.info(`  2. Refreshes token every ${config_1.config.scraper.tokenRefreshInterval / 60000} minutes`);
        logger_1.default.info('  3. Scraper uses refreshed token automatically');
        logger_1.default.info('  4. Check health: GET /health/token');
        logger_1.default.info('');
        logger_1.default.info('Next Steps:');
        logger_1.default.info('  • Start server: npm run dev');
        logger_1.default.info('  • Monitor logs for "Token refreshed successfully"');
        logger_1.default.info('  • Check health endpoint: curl http://localhost:3001/health/token');
    }
    else {
        logger_1.default.info('⚠️  Token refresh encountered issues');
        logger_1.default.info('');
        logger_1.default.info('Troubleshooting:');
        logger_1.default.info('  • Check browser executable path');
        logger_1.default.info('  • Verify TCAD website is accessible');
        logger_1.default.info('  • Review error logs above');
    }
}
// Run the test
testTokenRefresh()
    .then(() => {
    logger_1.default.info('');
    logger_1.default.info('Test complete!');
    process.exit(0);
})
    .catch((error) => {
    logger_1.default.error('');
    logger_1.default.error('Test failed:', error);
    process.exit(1);
});
//# sourceMappingURL=test-token-refresh.js.map