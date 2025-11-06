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
   * Refresh the token by capturing from browser
   */
  async refreshToken(): Promise<string | null> {
    if (this.isRefreshing) {
      logger.warn('Token refresh already in progress, skipping...');
      return this.currentToken;
    }

    this.isRefreshing = true;
    const startTime = Date.now();

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

      // Set up request interception to capture Authorization header
      page.on('request', (request) => {
        const headers = request.headers();
        if (headers['authorization'] && !capturedToken) {
          capturedToken = headers['authorization'];
          logger.info('Authorization token captured from request');
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

        // Wait for API request to be made
        await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 1000));

        if (!capturedToken) {
          throw new Error('Failed to capture authorization token from network requests');
        }

        // Update current token
        this.currentToken = capturedToken;
        this.lastRefreshTime = new Date();
        this.refreshCount++;

        const duration = Date.now() - startTime;
        logger.info(`Token refreshed successfully in ${duration}ms (refresh #${this.refreshCount})`);
        logger.info(`New token: ${capturedToken.substring(0, 30)}...`);

        return capturedToken;

      } finally {
        await context.close();
      }

    } catch (error) {
      this.failureCount++;
      const duration = Date.now() - startTime;
      logger.error(`Token refresh failed after ${duration}ms (failure #${this.failureCount}):`, error);

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

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down token refresh service...');
  await tokenRefreshService.cleanup();
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down token refresh service...');
  await tokenRefreshService.cleanup();
});
