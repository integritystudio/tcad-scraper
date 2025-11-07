#!/usr/bin/env node
/**
 * Debug Token Refresh
 * Tests the token refresh service and prints detailed diagnostics
 */

import { tokenRefreshService } from '../services/token-refresh.service';

async function debugTokenRefresh() {
  console.log('='.repeat(60));
  console.log('DEBUG: Token Refresh Service');
  console.log('='.repeat(60));

  // Check initial state
  console.log('\n1. Initial State:');
  console.log('   currentToken:', tokenRefreshService.getCurrentToken());

  const initialStats = tokenRefreshService.getStats();
  console.log('   Stats:', JSON.stringify(initialStats, null, 2));

  // Try to refresh token
  console.log('\n2. Calling refreshToken()...');
  const startTime = Date.now();

  try {
    const token = await tokenRefreshService.refreshToken();
    const duration = Date.now() - startTime;

    console.log(`\n3. refreshToken() returned after ${duration}ms:`);
    console.log('   Type:', typeof token);
    console.log('   Value:', token);
    console.log('   Length:', token ? token.length : 'N/A');
    console.log('   First 50 chars:', token ? token.substring(0, 50) : 'N/A');

  } catch (error) {
    console.error('\n3. refreshToken() threw error:', error);
  }

  // Check state after refresh
  console.log('\n4. State After Refresh:');
  console.log('   currentToken:', tokenRefreshService.getCurrentToken());

  const afterStats = tokenRefreshService.getStats();
  console.log('   Stats:', JSON.stringify(afterStats, null, 2));

  // Test getCurrentToken multiple times
  console.log('\n5. Multiple getCurrentToken() calls:');
  for (let i = 0; i < 3; i++) {
    const token = tokenRefreshService.getCurrentToken();
    console.log(`   Call ${i + 1}:`, token ? token.substring(0, 50) : 'null');
  }

  // Cleanup
  console.log('\n6. Cleaning up...');
  await tokenRefreshService.cleanup();

  console.log('\n' + '='.repeat(60));
  console.log('DEBUG: Complete');
  console.log('='.repeat(60));
}

debugTokenRefresh()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
