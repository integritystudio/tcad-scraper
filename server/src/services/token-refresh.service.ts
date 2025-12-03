/**
 * TCAD Token Refresh Service
 *
 * Automatically refreshes the TCAD API token by:
 * 1. Launching a headless browser
 * 2. Navigating to TCAD property search
 * 3. Performing a test search to trigger API call
 * 4. Capturing the Authorization header
 * 5. Updating the in-memory token
 *
 * Runs on a configurable schedule (default: every 4-5 minutes)
 */

import { chromium, Browser } from 'playwright';
import winston from 'winston';
import cron from 'node-cron';
import { config } from '../config';

const logger = winston.createLogger({
  level: config.logging.level || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

export class TCADTokenRefreshService {
  private currentToken: string | null = null;
  private browser: Browser | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;
  private cronJob: cron.ScheduledTask | null = null;
  private isRefreshing: boolean = false;
  private lastRefreshTime: Date | null = null;
  private refreshCount: number = 0;
  private failureCount: number = 0;

  constructor() {
    // Initialize with env token if available
    this.currentToken = config.scraper.tcadApiKey || null;

    if (this.currentToken) {
      logger.info('Token refresh service initialized with existing token from environment');
    } else {
      logger.info('Token refresh service initialized without token - will fetch on first refresh');
    }
  }

  /**
   * Get the current valid token
   */
  getCurrentToken(): string | null {
    return this.currentToken;
  }

  /**
   * Get refresh statistics
   */
  getStats() {
    return {
      currentToken: this.currentToken ? `${this.currentToken.substring(0, 20)}...` : null,
      lastRefreshTime: this.lastRefreshTime,
      refreshCount: this.refreshCount,
      failureCount: this.failureCount,
      isRefreshing: this.isRefreshing,
      isRunning: this.cronJob !== null || this.refreshInterval !== null,
    };
  }

  /**
   * Maximum time allowed for a single token refresh operation (60 seconds)
   */
  private static readonly REFRESH_TIMEOUT_MS = 60000;

  /**
   * Refresh the token by capturing from browser
   * Includes timeout protection to prevent hanging operations
   */
  async refreshToken(): Promise<string | null> {
    if (this.isRefreshing) {
      logger.warn('Token refresh already in progress, skipping...');
      return this.currentToken;
    }

    this.isRefreshing = true;
    const startTime = Date.now();

    // Timeout wrapper to prevent hanging
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Token refresh timed out after ${TCADTokenRefreshService.REFRESH_TIMEOUT_MS}ms`));
      }, TCADTokenRefreshService.REFRESH_TIMEOUT_MS);
    });

    try {
      return await Promise.race([
        this._performTokenRefresh(startTime),
        timeoutPromise
      ]);
    } catch (error: unknown) {
      this.failureCount++;
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Token refresh failed after ${duration}ms (failure #${this.failureCount}): ${errorMessage}`);

      // If we have a current token, keep using it
      if (this.currentToken) {
        logger.warn('Keeping existing token after refresh failure');
      }

      return this.currentToken;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Internal method that performs the actual token refresh
   */
  private async _performTokenRefresh(startTime: number): Promise<string | null> {

    try {
      logger.info('Starting token refresh...');

      // Initialize browser if needed
      if (!this.browser) {
        logger.info('Initializing browser for token refresh...');
        this.browser = await chromium.launch({
          headless: config.scraper.headless,
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
          args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--no-sandbox',
            '--disable-setuid-sandbox',
          ],
        });
        logger.info('Browser initialized for token refresh');
      }

      const context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
        timezoneId: 'America/Chicago',
      });

      const page = await context.newPage();
      let capturedToken: string | null = null;
      let tokenSource: string = 'none';

      // Helper function to validate and capture token
      const isValidToken = (value: string | undefined | null): boolean => {
        return !!(
          value &&
          value !== 'null' &&
          value.length > 50 &&
          value.startsWith('eyJ')
        );
      };

      const tryCapture = (value: string | undefined | null, source: string): boolean => {
        if (isValidToken(value) && !capturedToken) {
          capturedToken = value!;
          tokenSource = source;
          const tokenPreview = value!.substring(0, 50);
          logger.info(`Token captured from ${source}: length ${value!.length}, preview: ${tokenPreview}...`);
          return true;
        }
        return false;
      };

      // Strategy 1: Capture from REQUEST headers (multiple possible header names)
      page.on('request', (request) => {
        const headers = request.headers();
        const possibleHeaders = ['authorization', 'x-api-key', 'x-auth-token', 'bearer', 'token'];

        for (const headerName of possibleHeaders) {
          if (tryCapture(headers[headerName], `request header: ${headerName}`)) {
            break;
          }
        }
      });

      // Strategy 2: Capture from RESPONSE headers
      page.on('response', (response) => {
        const headers = response.headers();
        const possibleHeaders = ['authorization', 'x-api-key', 'x-auth-token', 'set-authorization'];

        for (const headerName of possibleHeaders) {
          if (tryCapture(headers[headerName], `response header: ${headerName}`)) {
            break;
          }
        }
      });

      try {
        // Navigate to TCAD property search
        logger.info('Navigating to TCAD property search...');
        await page.goto('https://travis.prodigycad.com/property-search', {
          waitUntil: 'networkidle',
          timeout: 30000,
        });

        // Wait for React app to load
        logger.info('Waiting for React app to load...');
        await page.waitForFunction(() => {
          const root = document.getElementById('root');
          return root && root.children.length > 0;
        }, { timeout: 15000 });

        // Perform a test search to trigger API request with auth token
        logger.info('Performing test search to capture token...');
        await page.waitForSelector('#searchInput', { timeout: 10000 });

        // Small delay to appear more human-like
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

        await page.type('#searchInput', 'test', { delay: 50 });
        await page.press('#searchInput', 'Enter');

        // Strategy 3: Wait for actual API request (not fixed delay)
        if (!capturedToken) {
          logger.info('Waiting for API request with auth token...');
          try {
            await page.waitForRequest(
              (request) => {
                const url = request.url();
                const headers = request.headers();
                return (
                  url.includes('api') &&
                  !!(headers['authorization'] || headers['x-api-key'])
                );
              },
              { timeout: 5000 }
            );
            logger.info('API request detected');
          } catch (waitError) {
            logger.warn('No API request with auth header detected within 5 seconds');
          }
        }

        // Strategy 4: Extract from browser storage if still not captured
        if (!capturedToken) {
          logger.info('Attempting to extract token from browser storage...');

          const storageToken = await page.evaluate(() => {
            const possibleKeys = ['token', 'authToken', 'auth_token', 'bearer', 'api_key', 'apiKey'];

            // Check localStorage
            for (const key of possibleKeys) {
              const value = localStorage.getItem(key);
              if (value && value !== 'null' && value.length > 50) {
                return { source: 'localStorage', key, value };
              }
            }

            // Check sessionStorage
            for (const key of possibleKeys) {
              const value = sessionStorage.getItem(key);
              if (value && value !== 'null' && value.length > 50) {
                return { source: 'sessionStorage', key, value };
              }
            }

            // Check cookies
            const cookies = document.cookie.split(';');
            for (const cookie of cookies) {
              const [name, value] = cookie.trim().split('=');
              if (possibleKeys.some(k => name.toLowerCase().includes(k)) &&
                  value && value.length > 50) {
                return { source: 'cookie', key: name, value };
              }
            }

            return null;
          });

          if (storageToken && tryCapture(storageToken.value, `${storageToken.source}: ${storageToken.key}`)) {
            logger.info(`Token successfully extracted from ${storageToken.source}`);
          }
        }

        if (!capturedToken) {
          throw new Error(`Failed to capture authorization token from any source (tried: request headers, response headers, localStorage, sessionStorage, cookies)`);
        }

        logger.info(`Token successfully captured from: ${tokenSource}`);

        // Update current token (TypeScript assertion needed after null check)
        const token: string = capturedToken;
        this.currentToken = token;
        this.lastRefreshTime = new Date();
        this.refreshCount++;

        const duration = Date.now() - startTime;
        const tokenPreview2 = token.substring(0, 30);
        logger.info(`Token refreshed successfully in ${duration}ms (refresh #${this.refreshCount}, source: ${tokenSource})`);
        logger.info(`New token: ${tokenPreview2}...`);

        return token;

      } finally {
        await context.close();
      }

    } catch (error) {
      // Re-throw to let the wrapper handle it
      throw error;
    }
  }

  /**
   * Start automatic token refresh using cron schedule
   * Default: Every 4-5 minutes (randomized to avoid detection patterns)
   */
  startAutoRefresh(cronSchedule?: string): void {
    if (this.cronJob) {
      logger.warn('Auto-refresh already running');
      return;
    }

    // Default: Run every 4.5 minutes
    // Cron format: */5 * * * * (every 5 minutes)
    // We'll use 4.5 minutes by alternating between 4 and 5 minute intervals
    const schedule = cronSchedule || '*/4 * * * *'; // Every 4 minutes as baseline

    logger.info(`Starting automatic token refresh (schedule: ${schedule})`);

    // Perform initial refresh
    this.refreshToken().catch((error) => {
      logger.error('Initial token refresh failed:', error);
    });

    // Schedule recurring refreshes
    this.cronJob = cron.schedule(schedule, async () => {
      logger.info('Scheduled token refresh triggered');
      await this.refreshToken();
    });

    logger.info('Automatic token refresh started successfully');
  }

  /**
   * Start automatic token refresh using interval (alternative to cron)
   * @param intervalMs Interval in milliseconds (default: 4.5 minutes)
   */
  startAutoRefreshInterval(intervalMs: number = 270000): void {
    if (this.refreshInterval) {
      logger.warn('Auto-refresh interval already running');
      return;
    }

    logger.info(`Starting automatic token refresh (interval: ${intervalMs}ms / ${intervalMs / 60000} minutes)`);

    // Perform initial refresh
    this.refreshToken().catch((error) => {
      logger.error('Initial token refresh failed:', error);
    });

    // Schedule recurring refreshes with slight randomization
    this.refreshInterval = setInterval(async () => {
      // Add ±30 seconds of randomization to avoid detection patterns
      const randomDelay = Math.floor(Math.random() * 60000) - 30000;
      await new Promise(resolve => setTimeout(resolve, Math.max(0, randomDelay)));

      logger.info('Scheduled token refresh triggered');
      await this.refreshToken();
    }, intervalMs);

    logger.info('Automatic token refresh interval started successfully');
  }

  /**
   * Stop automatic token refresh
   */
  stopAutoRefresh(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Cron-based token refresh stopped');
    }

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      logger.info('Interval-based token refresh stopped');
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up token refresh service...');

    this.stopAutoRefresh();

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('Browser closed');
    }

    logger.info('Token refresh service cleanup complete');
  }

  /**
   * Get health status
   */
  getHealth() {
    const timeSinceLastRefresh = this.lastRefreshTime
      ? Date.now() - this.lastRefreshTime.getTime()
      : null;

    return {
      healthy: this.currentToken !== null,
      hasToken: this.currentToken !== null,
      lastRefresh: this.lastRefreshTime,
      timeSinceLastRefresh,
      refreshCount: this.refreshCount,
      failureCount: this.failureCount,
      failureRate: this.refreshCount > 0
        ? (this.failureCount / (this.refreshCount + this.failureCount) * 100).toFixed(2) + '%'
        : '0%',
      isRefreshing: this.isRefreshing,
      isAutoRefreshRunning: this.cronJob !== null || this.refreshInterval !== null,
    };
  }
}

// Export singleton instance
export const tokenRefreshService = new TCADTokenRefreshService();

// Alias for backwards compatibility
export const tcadTokenRefreshService = tokenRefreshService;

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down token refresh service...');
  await tokenRefreshService.cleanup();
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down token refresh service...');
  await tokenRefreshService.cleanup();
});
