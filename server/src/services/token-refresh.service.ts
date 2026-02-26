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

import cron from "node-cron";
import type { Browser } from "playwright";
import { config } from "../config";
import { launchTCADBrowser } from "../lib/browser-factory";
import logger from "../lib/logger";
import { getErrorMessage } from "../utils/error-helpers";

export class TCADTokenRefreshService {
	private currentToken: string | null = null;
	private browser: Browser | null = null;
	private refreshInterval: NodeJS.Timeout | null = null;
	private cronJob: cron.ScheduledTask | null = null;
	private isRefreshing: boolean = false;
	private lastRefreshTime: Date | null = null;
	private refreshCount: number = 0;
	private failureCount: number = 0;
	private browserRefreshEnabled: boolean = true;

	constructor() {
		// Initialize with env token if available
		this.currentToken = config.scraper.tcadApiKey || null;

		if (this.currentToken) {
			logger.info(
				"Token refresh service initialized with existing token from environment",
			);
		} else {
			logger.info(
				"Token refresh service initialized without token - will fetch on first refresh",
			);
		}
	}

	/**
	 * Whether browser-based refresh is enabled.
	 * Disabled automatically when browser launch fails (e.g. on Render).
	 */
	isBrowserRefreshEnabled(): boolean {
		return this.browserRefreshEnabled;
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
			currentToken: this.currentToken
				? `...${this.currentToken.slice(-4)}`
				: null,
			lastRefreshTime: this.lastRefreshTime,
			refreshCount: this.refreshCount,
			failureCount: this.failureCount,
			isRefreshing: this.isRefreshing,
			isRunning: this.cronJob !== null || this.refreshInterval !== null,
			browserRefreshEnabled: this.browserRefreshEnabled,
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
			logger.warn("Token refresh already in progress, skipping...");
			return this.currentToken;
		}

		this.isRefreshing = true;
		const startTime = Date.now();

		// Timeout wrapper to prevent hanging
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => {
				reject(
					new Error(
						`Token refresh timed out after ${TCADTokenRefreshService.REFRESH_TIMEOUT_MS}ms`,
					),
				);
			}, TCADTokenRefreshService.REFRESH_TIMEOUT_MS);
		});

		try {
			return await Promise.race([
				this._performTokenRefresh(startTime),
				timeoutPromise,
			]);
		} catch (error: unknown) {
			this.failureCount++;
			const duration = Date.now() - startTime;
			const errorMessage = getErrorMessage(error);
			logger.error(
				`Token refresh failed after ${duration}ms (failure #${this.failureCount}): ${errorMessage}`,
			);

			// If we have a current token, keep using it
			if (this.currentToken) {
				logger.warn("Keeping existing token after refresh failure");
			}

			return this.currentToken;
		} finally {
			this.isRefreshing = false;
		}
	}

	/**
	 * Internal method that performs the actual token refresh
	 */
	private async _performTokenRefresh(
		startTime: number,
	): Promise<string | null> {
		// If browser refresh is disabled, return existing token (no-op)
		if (!this.browserRefreshEnabled) {
			logger.debug("Browser refresh disabled, using existing env token");
			return this.currentToken;
		}

		logger.info("Starting token refresh...");

		// Initialize browser if needed
		if (!this.browser) {
			logger.info("Initializing browser for token refresh...");
			try {
				this.browser = await launchTCADBrowser();
			} catch (error) {
				this.browserRefreshEnabled = false;
				logger.info(
					"Browser launch failed, disabling browser refresh — using env token: %s",
					getErrorMessage(error),
				);
				return this.currentToken;
			}
		}

		const context = await this.browser.newContext({
			userAgent:
				"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			viewport: { width: 1920, height: 1080 },
			locale: "en-US",
			timezoneId: "America/Chicago",
		});

		const page = await context.newPage();
		let capturedToken: string | null = null;
		let tokenSource: string = "none";

		// Helper function to validate and capture token
		const isValidToken = (value: string | undefined | null): boolean => {
			return !!(
				value &&
				value !== "null" &&
				value.length > 50 &&
				value.startsWith("eyJ")
			);
		};

		const tryCapture = (
			value: string | undefined | null,
			source: string,
		): boolean => {
			if (isValidToken(value) && !capturedToken) {
				capturedToken = value!;
				tokenSource = source;
				const tokenPreview = value?.substring(0, 50);
				logger.info(
					`Token captured from ${source}: length ${value?.length}, preview: ${tokenPreview}...`,
				);
				return true;
			}
			return false;
		};

		// Strategy 1: Capture from REQUEST headers (multiple possible header names)
		page.on("request", (request) => {
			const headers = request.headers();
			const possibleHeaders = [
				"authorization",
				"x-api-key",
				"x-auth-token",
				"bearer",
				"token",
			];

			for (const headerName of possibleHeaders) {
				if (tryCapture(headers[headerName], `request header: ${headerName}`)) {
					break;
				}
			}
		});

		// Strategy 2: Capture from RESPONSE headers
		page.on("response", (response) => {
			const headers = response.headers();
			const possibleHeaders = [
				"authorization",
				"x-api-key",
				"x-auth-token",
				"set-authorization",
			];

			for (const headerName of possibleHeaders) {
				if (tryCapture(headers[headerName], `response header: ${headerName}`)) {
					break;
				}
			}
		});

		try {
			// Navigate to TCAD property search
			logger.info("Navigating to TCAD property search...");
			await page.goto("https://travis.prodigycad.com/property-search", {
				waitUntil: "networkidle",
				timeout: 30000,
			});

			// Wait for React app to load
			logger.info("Waiting for React app to load...");
			await page.waitForFunction(
				() => {
					const root = document.getElementById("root");
					return root && root.children.length > 0;
				},
				{ timeout: 15000 },
			);

			// Perform a test search to trigger API request with auth token
			logger.info("Performing test search to capture token...");
			await page.waitForSelector("#searchInput", { timeout: 10000 });

			// Small delay to appear more human-like
			await new Promise((resolve) =>
				setTimeout(resolve, 500 + Math.random() * 500),
			);

			await page.type("#searchInput", "test", { delay: 50 });
			await page.press("#searchInput", "Enter");

			// Strategy 3: Wait for actual API request (not fixed delay)
			if (!capturedToken) {
				logger.info("Waiting for API request with auth token...");
				try {
					await page.waitForRequest(
						(request) => {
							const url = request.url();
							const headers = request.headers();
							return (
								url.includes("api") &&
								!!(headers.authorization || headers["x-api-key"])
							);
						},
						{ timeout: 5000 },
					);
					logger.info("API request detected");
				} catch (_waitError) {
					logger.warn(
						"No API request with auth header detected within 5 seconds",
					);
				}
			}

			// Strategy 4: Extract from browser storage if still not captured
			if (!capturedToken) {
				logger.info("Attempting to extract token from browser storage...");

				const storageToken = await page.evaluate(() => {
					const possibleKeys = [
						"token",
						"authToken",
						"auth_token",
						"bearer",
						"api_key",
						"apiKey",
					];

					// Check localStorage
					for (const key of possibleKeys) {
						const value = localStorage.getItem(key);
						if (value && value !== "null" && value.length > 50) {
							return { source: "localStorage", key, value };
						}
					}

					// Check sessionStorage
					for (const key of possibleKeys) {
						const value = sessionStorage.getItem(key);
						if (value && value !== "null" && value.length > 50) {
							return { source: "sessionStorage", key, value };
						}
					}

					// Check cookies
					const cookies = document.cookie.split(";");
					for (const cookie of cookies) {
						const [name, value] = cookie.trim().split("=");
						if (
							possibleKeys.some((k) => name.toLowerCase().includes(k)) &&
							value &&
							value.length > 50
						) {
							return { source: "cookie", key: name, value };
						}
					}

					return null;
				});

				if (
					storageToken &&
					tryCapture(
						storageToken.value,
						`${storageToken.source}: ${storageToken.key}`,
					)
				) {
					logger.info(
						`Token successfully extracted from ${storageToken.source}`,
					);
				}
			}

			if (!capturedToken) {
				throw new Error(
					`Failed to capture authorization token from any source (tried: request headers, response headers, localStorage, sessionStorage, cookies)`,
				);
			}

			logger.info(`Token successfully captured from: ${tokenSource}`);

			// Update current token (TypeScript assertion needed after null check)
			const token: string = capturedToken;
			this.currentToken = token;
			this.lastRefreshTime = new Date();
			this.refreshCount++;

			const duration = Date.now() - startTime;
			const tokenSuffix = token.slice(-4);
			logger.info(
				`Token refreshed successfully in ${duration}ms (refresh #${this.refreshCount}, source: ${tokenSource})`,
			);
			logger.debug(`New token: ...${tokenSuffix}`);

			return token;
		} finally {
			await context.close();
		}
	}

	/**
	 * Start automatic token refresh using cron schedule
	 * Default: Every 4-5 minutes (randomized to avoid detection patterns)
	 */
	startAutoRefresh(cronSchedule?: string): void {
		if (this.cronJob) {
			logger.warn("Auto-refresh already running");
			return;
		}

		// If we have an env token and browser refresh is already disabled, skip scheduling
		if (this.currentToken && !this.browserRefreshEnabled) {
			logger.info(
				"Skipping auto-refresh scheduling — using env token without browser",
			);
			return;
		}

		const schedule = cronSchedule || "*/4 * * * *";

		logger.info(`Starting automatic token refresh (schedule: ${schedule})`);

		// Perform initial refresh (may disable browser refresh on failure)
		this.refreshToken().catch((error: unknown) => {
			logger.error("Initial token refresh failed: %s", getErrorMessage(error));
		});

		// Only schedule recurring refreshes if browser refresh is still enabled
		if (this.browserRefreshEnabled) {
			this.cronJob = cron.schedule(schedule, async () => {
				if (!this.browserRefreshEnabled) {
					logger.debug("Skipping scheduled refresh — browser disabled");
					return;
				}
				logger.info("Scheduled token refresh triggered");
				await this.refreshToken();
			});

			logger.info("Automatic token refresh started successfully");
		}
	}

	/**
	 * Start automatic token refresh using interval (alternative to cron)
	 * @param intervalMs Interval in milliseconds (default: 4.5 minutes)
	 */
	startAutoRefreshInterval(intervalMs: number = 270000): void {
		if (this.refreshInterval) {
			logger.warn("Auto-refresh interval already running");
			return;
		}

		// If we have an env token and browser refresh is already disabled, skip scheduling
		if (this.currentToken && !this.browserRefreshEnabled) {
			logger.info(
				"Skipping auto-refresh interval — using env token without browser",
			);
			return;
		}

		logger.info(
			`Starting automatic token refresh (interval: ${intervalMs}ms / ${intervalMs / 60000} minutes)`,
		);

		// Perform initial refresh (may disable browser refresh on failure)
		this.refreshToken().catch((error: unknown) => {
			logger.error("Initial token refresh failed: %s", getErrorMessage(error));
		});

		// Only schedule if browser refresh is still enabled
		if (this.browserRefreshEnabled) {
			this.refreshInterval = setInterval(async () => {
				if (!this.browserRefreshEnabled) {
					logger.debug("Skipping scheduled refresh — browser disabled");
					return;
				}

				const randomDelay = Math.floor(Math.random() * 60000) - 30000;
				await new Promise((resolve) =>
					setTimeout(resolve, Math.max(0, randomDelay)),
				);

				logger.info("Scheduled token refresh triggered");
				await this.refreshToken();
			}, intervalMs);

			logger.info("Automatic token refresh interval started successfully");
		}
	}

	/**
	 * Stop automatic token refresh
	 */
	stopAutoRefresh(): void {
		if (this.cronJob) {
			this.cronJob.stop();
			this.cronJob = null;
			logger.info("Cron-based token refresh stopped");
		}

		if (this.refreshInterval) {
			clearInterval(this.refreshInterval);
			this.refreshInterval = null;
			logger.info("Interval-based token refresh stopped");
		}
	}

	/**
	 * Cleanup resources
	 */
	async cleanup(): Promise<void> {
		logger.info("Cleaning up token refresh service...");

		this.stopAutoRefresh();

		if (this.browser) {
			await this.browser.close();
			this.browser = null;
			logger.info("Browser closed");
		}

		logger.info("Token refresh service cleanup complete");
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
			failureRate:
				this.refreshCount > 0
					? `${(
							(this.failureCount / (this.refreshCount + this.failureCount)) *
								100
						).toFixed(2)}%`
					: "0%",
			isRefreshing: this.isRefreshing,
			isAutoRefreshRunning:
				this.cronJob !== null || this.refreshInterval !== null,
			browserRefreshEnabled: this.browserRefreshEnabled,
		};
	}
}

// Export singleton instance
export const tokenRefreshService = new TCADTokenRefreshService();

// Alias for backwards compatibility
export const tcadTokenRefreshService = tokenRefreshService;
