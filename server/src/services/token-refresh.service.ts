/**
 * TCAD Token Refresh Service
 *
 * Fetches fresh TCAD API tokens from the Cloudflare Worker endpoint.
 * Tokens expire after ~5 minutes; auto-refresh keeps them current.
 */

import { config } from "../config";
import logger from "../lib/logger";

const DEFAULT_REFRESH_INTERVAL_MS = 4 * 60 * 1000; // 4 min (tokens expire at 5)
const FETCH_TIMEOUT_MS = 10_000;
const TOKEN_EXPIRY_MS = 5 * 60 * 1000;
const EXPIRY_BUFFER_MS = 30_000;

interface TokenResponse {
  token: string;
  expiresIn: number;
}

export class TCADTokenRefreshService {
  private currentToken: string | null = null;
  private lastRefreshTime: Date | null = null;
  private successCount = 0;
  private failureCount = 0;
  private refreshPromise: Promise<string | null> | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private readonly workerUrl: string;
  private readonly workerSecret: string | undefined;

  constructor() {
    const url = config.scraper.tokenWorkerUrl;
    if (!url) {
      throw new Error(
        "TOKEN_WORKER_URL is not configured — set it in Doppler or environment",
      );
    }
    this.workerUrl = url;
    this.workerSecret = config.scraper.tokenWorkerSecret;

    if (!this.workerSecret) {
      logger.warn("TOKEN_WORKER_SECRET not set — requests will be unauthenticated");
    }

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
      successCount: this.successCount,
      failureCount: this.failureCount,
      isRefreshing: this.refreshPromise !== null,
      isRunning: this.refreshTimer !== null,
    };
  }

  /**
   * Fetch a fresh token from the Cloudflare Worker.
   * Concurrent callers share a single in-flight request.
   */
  async refreshToken(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.doRefresh().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  private async doRefresh(): Promise<string | null> {
    try {
      const headers: Record<string, string> = {};
      if (this.workerSecret) {
        headers.Authorization = `Bearer ${this.workerSecret}`;
      }

      const res = await fetch(this.workerUrl, {
        headers,
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
      this.successCount++;

      logger.info(
        `Token refreshed (expiresIn=${data.expiresIn}s, count=${this.successCount})`,
      );
      return this.currentToken;
    } catch (error) {
      this.failureCount++;
      const msg =
        error instanceof Error ? error.message : String(error);
      logger.error(`Token refresh failed (failures=${this.failureCount}): ${msg}`);
      return this.currentToken;
    }
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
    const ageMs = this.lastRefreshTime
      ? Date.now() - this.lastRefreshTime.getTime()
      : null;
    const expiresInMs =
      ageMs !== null ? TOKEN_EXPIRY_MS - ageMs : null;
    const tokenExpired =
      expiresInMs !== null && expiresInMs <= EXPIRY_BUFFER_MS;

    return {
      healthy: this.currentToken !== null && !tokenExpired,
      hasToken: this.currentToken !== null,
      lastRefresh: this.lastRefreshTime,
      timeSinceLastRefresh: ageMs,
      expiresInMs,
      successCount: this.successCount,
      failureCount: this.failureCount,
      failureRate:
        this.successCount > 0
          ? `${(
              (this.failureCount / (this.successCount + this.failureCount)) *
              100
            ).toFixed(2)}%`
          : "0%",
      isRefreshing: this.refreshPromise !== null,
      isAutoRefreshRunning: this.refreshTimer !== null,
    };
  }
}

// Export singleton instance
export const tokenRefreshService = new TCADTokenRefreshService();

// Alias for backwards compatibility
export const tcadTokenRefreshService = tokenRefreshService;
