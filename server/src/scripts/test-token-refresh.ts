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

import { tokenRefreshService } from '../services/token-refresh.service';
import { config } from '../config';

console.log('=== TCAD Token Auto-Refresh Service Test ===\n');

async function testTokenRefresh() {
  console.log('Configuration:');
  console.log('--------------');
  console.log(`Auto-Refresh Enabled: ${config.scraper.autoRefreshToken}`);
  console.log(`Refresh Interval: ${config.scraper.tokenRefreshInterval}ms (${config.scraper.tokenRefreshInterval / 60000} minutes)`);
  console.log(`Cron Schedule: ${config.scraper.tokenRefreshCron || 'Not set (using interval)'}`);
  console.log('');

  // Test 1: Check initial state
  console.log('Test 1: Initial State');
  console.log('---------------------');
  const initialStats = tokenRefreshService.getStats();
  console.log(`Current Token: ${initialStats.currentToken || 'None'}`);
  console.log(`Last Refresh: ${initialStats.lastRefreshTime || 'Never'}`);
  console.log(`Refresh Count: ${initialStats.refreshCount}`);
  console.log(`Failure Count: ${initialStats.failureCount}`);
  console.log(`Is Running: ${initialStats.isRunning}`);
  console.log('');

  // Test 2: Manual token refresh
  console.log('Test 2: Manual Token Refresh');
  console.log('-----------------------------');
  console.log('⏳ Refreshing token (this may take 5-10 seconds)...');
  console.log('');

  const startTime = Date.now();
  const token = await tokenRefreshService.refreshToken();
  const duration = Date.now() - startTime;

  console.log('');
  if (token) {
    console.log(`✅ Token refreshed successfully in ${duration}ms`);
    console.log(`Token preview: ${token.substring(0, 50)}...`);
  } else {
    console.log(`❌ Token refresh failed`);
  }
  console.log('');

  // Test 3: Check stats after refresh
  console.log('Test 3: Statistics After Refresh');
  console.log('---------------------------------');
  const statsAfterRefresh = tokenRefreshService.getStats();
  console.log(`Current Token: ${statsAfterRefresh.currentToken || 'None'}`);
  console.log(`Last Refresh: ${statsAfterRefresh.lastRefreshTime}`);
  console.log(`Refresh Count: ${statsAfterRefresh.refreshCount}`);
  console.log(`Failure Count: ${statsAfterRefresh.failureCount}`);
  console.log('');

  // Test 4: Health check
  console.log('Test 4: Health Check');
  console.log('--------------------');
  const health = tokenRefreshService.getHealth();
  console.log(`Healthy: ${health.healthy ? '✅' : '❌'}`);
  console.log(`Has Token: ${health.hasToken ? '✅' : '❌'}`);
  console.log(`Time Since Last Refresh: ${health.timeSinceLastRefresh ? `${health.timeSinceLastRefresh}ms` : 'N/A'}`);
  console.log(`Failure Rate: ${health.failureRate}`);
  console.log(`Auto-Refresh Running: ${health.isAutoRefreshRunning ? '✅' : '❌'}`);
  console.log('');

  // Test 5: Demo auto-refresh (run for 30 seconds)
  if (config.scraper.autoRefreshToken) {
    console.log('Test 5: Auto-Refresh Demo');
    console.log('-------------------------');
    console.log('⏳ Starting auto-refresh service for 30 seconds...');
    console.log('   (In production, this runs continuously)');
    console.log('');

    // Start auto-refresh with a short interval for demo (30 seconds)
    tokenRefreshService.startAutoRefreshInterval(30000); // 30 seconds for demo

    console.log('Service started. Waiting for first scheduled refresh...');
    console.log('(Press Ctrl+C to stop early)');
    console.log('');

    // Wait 35 seconds to see at least one refresh
    await new Promise(resolve => setTimeout(resolve, 35000));

    // Stop auto-refresh
    tokenRefreshService.stopAutoRefresh();
    console.log('');
    console.log('Auto-refresh stopped.');
    console.log('');

    // Show final stats
    const finalStats = tokenRefreshService.getStats();
    console.log('Final Statistics:');
    console.log(`  Total Refreshes: ${finalStats.refreshCount}`);
    console.log(`  Total Failures: ${finalStats.failureCount}`);
    console.log(`  Last Refresh: ${finalStats.lastRefreshTime}`);
    console.log('');
  } else {
    console.log('Test 5: Auto-Refresh Demo');
    console.log('-------------------------');
    console.log('⚠️  Auto-refresh is disabled in configuration');
    console.log('   Set TCAD_AUTO_REFRESH_TOKEN=true to enable');
    console.log('');
  }

  // Cleanup
  console.log('Cleaning up...');
  await tokenRefreshService.cleanup();
  console.log('✅ Cleanup complete');
  console.log('');

  // Summary
  console.log('=== Summary ===');
  console.log('');

  const finalHealth = tokenRefreshService.getHealth();
  if (finalHealth.healthy) {
    console.log('✅ Token refresh service is working correctly');
    console.log('');
    console.log('Production Usage:');
    console.log('  1. Service starts automatically with server');
    console.log(`  2. Refreshes token every ${config.scraper.tokenRefreshInterval / 60000} minutes`);
    console.log('  3. Scraper uses refreshed token automatically');
    console.log('  4. Check health: GET /health/token');
    console.log('');
    console.log('Next Steps:');
    console.log('  • Start server: npm run dev');
    console.log('  • Monitor logs for "Token refreshed successfully"');
    console.log('  • Check health endpoint: curl http://localhost:3001/health/token');
  } else {
    console.log('⚠️  Token refresh encountered issues');
    console.log('');
    console.log('Troubleshooting:');
    console.log('  • Check browser executable path');
    console.log('  • Verify TCAD website is accessible');
    console.log('  • Review error logs above');
  }
}

// Run the test
testTokenRefresh()
  .then(() => {
    console.log('');
    console.log('Test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('Test failed:', error);
    process.exit(1);
  });
