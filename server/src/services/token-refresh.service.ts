/**
 * TCAD Token Refresh Service
 *
 * Fetches fresh TCAD API tokens from the Cloudflare Worker endpoint.
 * Tokens expire after ~5 minutes; auto-refresh keeps them current.
 */

import logger from "../lib/logger";

const TOKEN_WORKER_URL =
  "https://tcad-token-refresh.alyshia-b38.workers.dev/";

const DEFAULT_REFRESH_INTERVAL_MS = 4 * 60 * 1000; // 4 min (tokens expire at 5)
const FETCH_TIMEOUT_MS = 10_000;

interface TokenResponse {
  token: string;
  expiresIn: number;
}

export class TCADTokenRefreshService {
  private currentToken: string | null = null;
  private lastRefreshTime: Date | null = null;
  private refreshCount = 0;
  private failureCount = 0;
  private isRefreshing = false;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    logger.info("Token refresh service initialized (worker mode)");
  }

  getCurrentToken(): string | null {
    return this.currentToken;
  }

  getStats() {
    return {
      currentToken: this.currentToken
        ? `...${this.currentToken.slice(-4)}`
        : null,
      lastRefreshTime: this.lastRefreshTime,
      refreshCount: this.refreshCount,
      failureCount: this.failureCount,
      isRefreshing: this.isRefreshing,
      isRunning: this.refreshTimer !== null,
    };
  }

  /**
   * Fetch a fresh token from the Cloudflare Worker.
   */
  async refreshToken(): Promise<string | null> {
    if (this.isRefreshing) {
      logger.debug("Token refresh already in progress, waiting...");
      return this.currentToken;
    }

    this.isRefreshing = true;

    try {
      const res = await fetch(TOKEN_WORKER_URL, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!res.ok) {
        throw new Error(`Worker returned HTTP ${res.status}`);
      }

      const data = (await res.json()) as TokenResponse;

      if (!data.token) {
        throw new Error("Worker response missing token");
      }

      this.currentToken = data.token;
      this.lastRefreshTime = new Date();
      this.refreshCount++;

      logger.info(
        `Token refreshed (expiresIn=${data.expiresIn}s, count=${this.refreshCount})`,
      );
      return this.currentToken;
    } catch (error) {
      this.failureCount++;
      const msg =
        error instanceof Error ? error.message : "Unknown error";
      logger.error(`Token refresh failed (failures=${this.failureCount}): ${msg}`);
      return this.currentToken;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Start auto-refresh on an interval (default 4 min).
   */
  startAutoRefresh(_cronSchedule?: string): void {
    this.startAutoRefreshInterval();
  }

  /**
   * Start auto-refresh on an interval.
   */
  startAutoRefreshInterval(intervalMs?: number): void {
    if (this.refreshTimer) {
      logger.warn("Auto-refresh already running, stopping previous");
      this.stopAutoRefresh();
    }

    const interval = intervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;

    this.refreshTimer = setInterval(() => {
      this.refreshToken().catch((err) => {
        logger.error(`Auto-refresh error: ${err instanceof Error ? err.message : err}`);
      });
    }, interval);

    logger.info(`Auto-refresh started (interval=${interval / 1000}s)`);
  }

  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      logger.info("Auto-refresh stopped");
    }
  }

  async cleanup(): Promise<void> {
    this.stopAutoRefresh();
    logger.info("Token refresh service cleanup complete");
  }

  getHealth() {
    return {
      healthy: this.currentToken !== null,
      hasToken: this.currentToken !== null,
      lastRefresh: this.lastRefreshTime,
      timeSinceLastRefresh: this.lastRefreshTime
        ? Date.now() - this.lastRefreshTime.getTime()
        : null,
      refreshCount: this.refreshCount,
      failureCount: this.failureCount,
      failureRate:
        this.refreshCount > 0
          ? `${(
              (this.failureCount / (this.refreshCount + this.failureCount)) *
              100
            ).toFixed(2)}%`
          : "0%",
      isRefreshing: this.isRefreshing,
      isAutoRefreshRunning: this.refreshTimer !== null,
    };
  }
}

// Export singleton instance
export const tokenRefreshService = new TCADTokenRefreshService();

// Alias for backwards compatibility
export const tcadTokenRefreshService = tokenRefreshService;
