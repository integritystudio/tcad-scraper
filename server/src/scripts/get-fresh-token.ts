#!/usr/bin/env node
/**
 * Simple script to get a fresh TCAD API token and output it
 */
import { tokenRefreshService } from '../services/token-refresh.service';

async function getFreshToken() {
  try {
    // eslint-disable-next-line no-console
    console.error('Refreshing token...');
    const token = await tokenRefreshService.refreshToken();

    if (token) {
      // Output ONLY the token to stdout (everything else to stderr)
      // eslint-disable-next-line no-console
      console.log(token);
      process.exit(0);
    } else {
      // eslint-disable-next-line no-console
      console.error('Failed to refresh token');
      process.exit(1);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error:', error);
    process.exit(1);
  }
}

getFreshToken();
