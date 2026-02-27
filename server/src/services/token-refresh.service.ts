/**
 * TCAD Token Refresh Service
 *
 * Manages the TCAD API token from the environment (TCAD_API_KEY).
 * Browser-based refresh has been removed; tokens are managed externally via Doppler.
 */

import { config } from "../config";
import logger from "../lib/logger";

export class TCADTokenRefreshService {
	private currentToken: string | null = null;
	private lastRefreshTime: Date | null = null;
	private refreshCount: number = 0;
	private failureCount: number = 0;

	constructor() {
		this.currentToken = config.scraper.tcadApiKey || null;

		if (this.currentToken) {
			logger.info("Token refresh service initialized with env token");
		} else {
			logger.info(
				"Token refresh service initialized without token — set TCAD_API_KEY",
			);
		}
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
			isRefreshing: false,
			isRunning: false,
		};
	}

	/**
	 * Returns the current env token (no browser refresh).
	 */
	async refreshToken(): Promise<string | null> {
		logger.info("Token refresh requested — returning env token");
		return this.currentToken;
	}

	/**
	 * No-op: auto-refresh is not needed with env-managed tokens.
	 */
	startAutoRefresh(_cronSchedule?: string): void {
		logger.info("Auto-refresh is a no-op in env-token mode");
	}

	/**
	 * No-op: auto-refresh is not needed with env-managed tokens.
	 */
	startAutoRefreshInterval(_intervalMs?: number): void {
		logger.info("Auto-refresh interval is a no-op in env-token mode");
	}

	stopAutoRefresh(): void {
		// No-op
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
			isRefreshing: false,
			isAutoRefreshRunning: false,
		};
	}
}

// Export singleton instance
export const tokenRefreshService = new TCADTokenRefreshService();

// Alias for backwards compatibility
export const tcadTokenRefreshService = tokenRefreshService;
