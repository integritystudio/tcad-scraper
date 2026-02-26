import type { Browser } from "playwright";
import { config as appConfig } from "../config";
import { tokenRefreshService } from "../services/token-refresh.service";
import type { PropertyData, ScraperConfig } from "../types";
import { suppressBrowserConsoleWarnings } from "../utils/browser-console-suppression";
import { getErrorMessage } from "../utils/error-helpers";
import { humanDelay } from "../utils/timing";
import { launchTCADBrowser } from "./browser-factory";
import { scrapeDOMFallback } from "./fallback/dom-scraper";
import logger from "./logger";
import {
	fetchTCADProperties,
	mapTCADResultToPropertyData,
	type TCADApiResponse,
	type TCADPropertyResult,
} from "./tcad-api-client";

export type { TCADApiResponse, TCADPropertyResult };

export class TCADScraper {
	private browser: Browser | null = null;
	private browserAvailable = false;
	private config: ScraperConfig;

	constructor(config?: Partial<ScraperConfig>) {
		// Configure proxy if enabled
		let proxyConfig = {};

		if (
			appConfig.scraper.brightData.enabled &&
			appConfig.scraper.brightData.apiToken &&
			appConfig.scraper.brightData.customerId
		) {
			// Bright Data proxy configuration
			proxyConfig = {
				proxyServer: `http://${appConfig.scraper.brightData.proxyHost}:${appConfig.scraper.brightData.proxyPort}`,
				proxyUsername: `brd-customer-${appConfig.scraper.brightData.customerId}-zone-residential`,
				proxyPassword: appConfig.scraper.brightData.apiToken,
			};
			logger.info("Bright Data proxy configured");
		} else if (
			appConfig.scraper.proxy.enabled &&
			appConfig.scraper.proxy.server
		) {
			// Generic proxy configuration
			proxyConfig = {
				proxyServer: appConfig.scraper.proxy.server,
				proxyUsername: appConfig.scraper.proxy.username,
				proxyPassword: appConfig.scraper.proxy.password,
			};
			logger.info("Generic proxy configured");
		}

		this.config = {
			headless: appConfig.scraper.headless,
			timeout: appConfig.scraper.timeout,
			retryAttempts: appConfig.scraper.retryAttempts,
			retryDelay: appConfig.scraper.retryDelay,
			userAgents: appConfig.scraper.userAgents,
			viewports: appConfig.scraper.viewports,
			...proxyConfig,
			...config,
		};
	}

	async initialize(): Promise<void> {
		// Check if we already have a token (from refresh service or env)
		const existingToken =
			tokenRefreshService.getCurrentToken() ||
			appConfig.scraper.tcadApiKey ||
			null;

		if (existingToken) {
			// Try to launch browser, but don't fail if unavailable
			try {
				const proxyOptions = this.config.proxyServer
					? {
							proxy: {
								server: this.config.proxyServer,
								username: this.config.proxyUsername,
								password: this.config.proxyPassword,
							},
						}
					: undefined;

				this.browser = await launchTCADBrowser(proxyOptions);
				this.browserAvailable = true;
				logger.info("Browser launched (token + browser available)");
			} catch (error) {
				this.browserAvailable = false;
				logger.info(
					"Browser unavailable, using API-direct mode with existing token: %s",
					getErrorMessage(error),
				);
			}
			return;
		}

		// No token — must launch browser for token capture
		try {
			const proxyEnabled = !!this.config.proxyServer;
			logger.info(
				`Initializing browser for token capture${proxyEnabled ? " with Bright Data proxy" : ""}...`,
			);

			const proxyOptions = this.config.proxyServer
				? {
						proxy: {
							server: this.config.proxyServer,
							username: this.config.proxyUsername,
							password: this.config.proxyPassword,
						},
					}
				: undefined;

			this.browser = await launchTCADBrowser(proxyOptions);
			this.browserAvailable = true;
		} catch (error) {
			logger.error("Failed to initialize browser: %s", getErrorMessage(error));
			throw error;
		}
	}

	private getRandomElement<T>(array: T[]): T {
		return array[Math.floor(Math.random() * array.length)];
	}

	/**
	 * PRIMARY METHOD: Scrape properties using direct API calls through browser context
	 *
	 * This is the RECOMMENDED method that:
	 * - Bypasses the 20-result UI limitation
	 * - Can fetch up to 1000 results per API call
	 * - Handles authentication automatically
	 * - Implements adaptive page sizing
	 *
	 * If this method fails after all retries, the system will automatically
	 * fall back to DOM-based scraping (limited to 20 results).
	 *
	 * @param searchTerm - The search term to query
	 * @param maxRetries - Maximum retry attempts (default: 3)
	 * @returns Array of PropertyData
	 * @throws Error if all API attempts fail (triggers fallback in calling code)
	 */
	async scrapePropertiesViaAPI(
		searchTerm: string,
		maxRetries: number = 3,
	): Promise<PropertyData[]> {
		// Acquire token first (needed for both paths)
		let authToken: string | null = null;

		if (appConfig.scraper.autoRefreshToken) {
			authToken = tokenRefreshService.getCurrentToken();
			if (authToken) {
				logger.info("Using token from auto-refresh service");
			}
		}
		if (!authToken) {
			authToken = appConfig.scraper.tcadApiKey || null;
		}

		// API-direct mode: token available, no browser needed
		if (authToken && !this.browserAvailable) {
			return this.scrapeViaNodeFetch(authToken, searchTerm, maxRetries);
		}

		// Browser-based mode
		if (!this.browser) {
			throw new Error(
				"No token available and browser not initialized. Call initialize() first.",
			);
		}

		return this.scrapeViaBrowser(authToken, searchTerm, maxRetries);
	}

	/**
	 * API-direct scraping using native Node.js fetch (no browser)
	 */
	private async scrapeViaNodeFetch(
		token: string,
		searchTerm: string,
		maxRetries: number,
	): Promise<PropertyData[]> {
		let lastError: Error | null = null;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				logger.info(
					`API-direct scraping attempt ${attempt} for: ${searchTerm}`,
				);

				const response = await fetchTCADProperties(
					token,
					searchTerm,
					appConfig.scraper.tcadYear,
				);

				logger.info(
					`API returned ${response.totalCount} total properties, fetched ${response.results.length} results (pageSize: ${response.pageSize})`,
				);

				const properties = response.results.map(mapTCADResultToPropertyData);
				logger.info(`Extracted ${properties.length} properties via API-direct`);
				return properties;
			} catch (error) {
				lastError = error as Error;
				logger.error(
					`API-direct attempt ${attempt} failed: %s`,
					getErrorMessage(error),
				);

				if (attempt < maxRetries) {
					const delay = this.config.retryDelay * 2 ** (attempt - 1);
					logger.info(`Retrying in ${delay}ms...`);
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
			}
		}

		throw lastError || new Error("All API-direct scraping attempts failed");
	}

	/**
	 * Browser-based scraping: injects fetch into browser context
	 */
	private async scrapeViaBrowser(
		authToken: string | null,
		searchTerm: string,
		maxRetries: number,
	): Promise<PropertyData[]> {
		let lastError: Error | null = null;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				logger.info(
					`Browser API scraping attempt ${attempt} for search term: ${searchTerm}`,
				);

				const context = await this.browser!.newContext({
					userAgent: this.getRandomElement(this.config.userAgents),
					viewport: this.getRandomElement(this.config.viewports),
					locale: "en-US",
					timezoneId: "America/Chicago",
				});

				const page = await context.newPage();

				// Suppress browser console warnings from TCAD website
				suppressBrowserConsoleWarnings(page, logger);

				try {
					let token = authToken;

					if (token) {
						logger.info("Using pre-fetched TCAD_API_KEY from environment");
					} else {
						logger.info(
							"No TCAD_API_KEY found, capturing token from browser...",
						);

						page.on("request", (request) => {
							const headers = request.headers();
							const authHeader = headers.authorization;

							if (
								authHeader &&
								authHeader !== "null" &&
								authHeader.length > 50 &&
								authHeader.startsWith("eyJ") &&
								!token
							) {
								token = authHeader;
								logger.info(
									`Auth token captured: length ${token.length}, preview: ${token.substring(0, 50)}...`,
								);
							}
						});

						await page.goto("https://travis.prodigycad.com/property-search", {
							waitUntil: "networkidle",
							timeout: this.config.timeout,
						});

						logger.info("Page loaded, waiting for React app...");

						await page.waitForFunction(
							() => {
								const root = document.getElementById("root");
								return root && root.children.length > 0;
							},
							{ timeout: 15000 },
						);

						await page.waitForSelector("#searchInput", { timeout: 10000 });
						await humanDelay(500, 1000);
						await page.type("#searchInput", "test", { delay: 50 });
						await page.press("#searchInput", "Enter");
						await humanDelay(3000, 4000);

						if (!token) {
							throw new Error("Failed to capture authorization token");
						}

						logger.info("Auth token captured from browser");
					}

					await page.addScriptTag({
						content: `
              window.__tcad_search = function(token, term) {
                const apiUrl = 'https://prod-container.trueprodigyapi.com/public/property/searchfulltext';
                const pageSizes = [1000, 500, 100, 50];
                let currentSizeIndex = 0;
                let lastErr = '';
                const RATE_LIMIT_DELAY = 1000;

                return new Promise(function(resolve, reject) {
                  function tryNextPageSize() {
                    if (currentSizeIndex >= pageSizes.length) {
                      reject(new Error('All page sizes failed. Last: ' + lastErr));
                      return;
                    }

                    const pageSize = pageSizes[currentSizeIndex];
                    const allResults = [];
                    let totalCount = 0;
                    let currentPage = 1;

                    fetch(apiUrl + '?page=1&pageSize=' + pageSize, {
                      method: 'POST',
                      headers: {
                        'Authorization': token,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                      },
                      body: JSON.stringify({
                        pYear: { operator: '=', value: '${appConfig.scraper.tcadYear}' },
                        fullTextSearch: { operator: 'match', value: term }
                      })
                    })
                    .then(function(r) {
                      if (!r.ok) {
                        if (r.status === 401) throw new Error('HTTP 401 TOKEN_EXPIRED');
                        if (r.status === 504) throw new Error('HTTP 504 GATEWAY_TIMEOUT');
                        throw new Error('HTTP ' + r.status);
                      }
                      return r.text();
                    })
                    .then(function(text) {
                      const trimmed = text.trim();
                      if (trimmed.length > 0 && trimmed[trimmed.length - 1] !== '}' && trimmed[trimmed.length - 1] !== ']') {
                        throw new Error('TRUNCATED');
                      }

                      const data = JSON.parse(trimmed);
                      totalCount = data.totalProperty?.propertyCount || 0;
                      const firstPageResults = data.results || [];
                      allResults.push.apply(allResults, firstPageResults);

                      if (allResults.length >= totalCount || firstPageResults.length < pageSize) {
                        resolve({ totalCount: totalCount, results: allResults, pageSize: pageSize });
                        return;
                      }

                      function fetchNextPage() {
                        currentPage++;
                        if (allResults.length >= totalCount || currentPage > 100) {
                          resolve({ totalCount: totalCount, results: allResults, pageSize: pageSize });
                          return;
                        }

                        setTimeout(function() {
                          fetch(apiUrl + '?page=' + currentPage + '&pageSize=' + pageSize, {
                          method: 'POST',
                          headers: {
                            'Authorization': token,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                          },
                          body: JSON.stringify({
                            pYear: { operator: '=', value: '${appConfig.scraper.tcadYear}' },
                            fullTextSearch: { operator: 'match', value: term }
                          })
                        })
                        .then(function(r) {
                          if (!r.ok) {
                        if (r.status === 401) throw new Error('HTTP 401 TOKEN_EXPIRED');
                        if (r.status === 504) throw new Error('HTTP 504 GATEWAY_TIMEOUT');
                        throw new Error('HTTP ' + r.status);
                      }
                          return r.text();
                        })
                        .then(function(text) {
                          const trimmed = text.trim();
                          if (trimmed.length > 0 && trimmed[trimmed.length - 1] !== '}' && trimmed[trimmed.length - 1] !== ']') {
                            throw new Error('TRUNCATED');
                          }

                          const data = JSON.parse(trimmed);
                          const pageResults = data.results || [];
                          allResults.push.apply(allResults, pageResults);

                          if (pageResults.length < pageSize || allResults.length >= totalCount) {
                            resolve({ totalCount: totalCount, results: allResults, pageSize: pageSize });
                          } else {
                            fetchNextPage();
                          }
                        })
                        .catch(function(err) {
                          if (err.message === 'TRUNCATED' || err.message.indexOf('JSON') >= 0) {
                            currentSizeIndex++;
                            lastErr = err.message;
                            tryNextPageSize();
                          } else if (err.message.indexOf('TOKEN_EXPIRED') >= 0) {
                            reject(new Error('TOKEN_EXPIRED: Authorization token expired, needs refresh'));
                          } else if (err.message.indexOf('HTTP 409') >= 0) {
                            setTimeout(function() {
                              fetchNextPage();
                            }, RATE_LIMIT_DELAY * 2);
                          } else if (err.message.indexOf('GATEWAY_TIMEOUT') >= 0) {
                            setTimeout(function() {
                              fetchNextPage();
                            }, RATE_LIMIT_DELAY * 5);
                          } else {
                            reject(err);
                          }
                        });
                        }, RATE_LIMIT_DELAY);
                      }

                      fetchNextPage();
                    })
                    .catch(function(err) {
                      if (err.message === 'TRUNCATED' || err.message.indexOf('JSON') >= 0) {
                        currentSizeIndex++;
                        lastErr = err.message;
                        tryNextPageSize();
                      } else if (err.message.indexOf('TOKEN_EXPIRED') >= 0) {
                        reject(new Error('TOKEN_EXPIRED: Authorization token expired, needs refresh'));
                      } else if (err.message.indexOf('HTTP 409') >= 0) {
                        setTimeout(function() {
                          currentSizeIndex++;
                          lastErr = err.message;
                          tryNextPageSize();
                        }, RATE_LIMIT_DELAY * 3);
                      } else if (err.message.indexOf('GATEWAY_TIMEOUT') >= 0) {
                        setTimeout(function() {
                          currentSizeIndex++;
                          lastErr = err.message;
                          tryNextPageSize();
                        }, RATE_LIMIT_DELAY * 5);
                      } else {
                        reject(err);
                      }
                    });
                  }

                  tryNextPageSize();
                });
              };
            `,
					});

					const allProperties = (await page.evaluate(
						`window.__tcad_search('${token}', '${searchTerm.replace(/'/g, "\\'")}')`,
					)) as TCADApiResponse;

					logger.info(
						`API returned ${allProperties.totalCount} total properties, fetched ${allProperties.results.length} results (pageSize: ${allProperties.pageSize})`,
					);

					const properties: PropertyData[] = allProperties.results.map(
						mapTCADResultToPropertyData,
					);

					logger.info(`Extracted ${properties.length} properties via API`);

					return properties;
				} finally {
					await context.close();
				}
			} catch (error) {
				lastError = error as Error;
				logger.error(
					`API scraping attempt ${attempt} failed: %s`,
					getErrorMessage(error),
				);

				if (attempt < maxRetries) {
					const delay = this.config.retryDelay * 2 ** (attempt - 1);
					logger.info(`Retrying in ${delay}ms...`);
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
			}
		}

		throw lastError || new Error("All API scraping attempts failed");
	}

	/**
	 * FALLBACK METHOD: Scrape properties with automatic fallback to DOM scraping
	 *
	 * This method attempts the primary API-based scraping first.
	 * If the API method fails after all retries, it automatically falls back
	 * to DOM-based scraping (limited to 20 results).
	 *
	 * @param searchTerm - The search term to query
	 * @param maxRetries - Maximum retry attempts for each method
	 * @returns Array of PropertyData
	 */
	async scrapePropertiesWithFallback(
		searchTerm: string,
		maxRetries: number = 3,
	): Promise<PropertyData[]> {
		logger.info(`Starting scrape for: ${searchTerm}`);

		try {
			logger.info("Attempting primary method: API-based scraping");
			const properties = await this.scrapePropertiesViaAPI(
				searchTerm,
				maxRetries,
			);
			logger.info(
				`Primary method succeeded: Retrieved ${properties.length} properties`,
			);
			return properties;
		} catch (apiError) {
			logger.error(
				"Primary API method failed after all retries: %s",
				getErrorMessage(apiError),
			);

			// DOM fallback requires a browser
			if (!this.browserAvailable || !this.browser) {
				logger.warn(
					"DOM fallback unavailable (no browser) — re-throwing API error",
				);
				throw apiError;
			}

			logger.warn("Falling back to DOM-based scraping (limited to 20 results)");

			try {
				const properties = await scrapeDOMFallback(
					this.browser,
					this.config,
					searchTerm,
					maxRetries,
				);
				logger.info(
					`Fallback method succeeded: Retrieved ${properties.length} properties (max 20)`,
				);
				return properties;
			} catch (fallbackError) {
				logger.error(
					"Fallback method also failed: %s",
					getErrorMessage(fallbackError),
				);
				throw new Error(
					`Both scraping methods failed. API error: ${getErrorMessage(apiError)}. ` +
						`Fallback error: ${getErrorMessage(fallbackError)}`,
				);
			}
		}
	}

	async cleanup(): Promise<void> {
		if (this.browser) {
			logger.info("Closing browser...");
			await this.browser.close();
			this.browser = null;
			logger.info("Browser closed");
		}
	}

	// Helper method for health check
	async testConnection(): Promise<boolean> {
		try {
			await this.initialize();
			const context = await this.browser?.newContext();
			if (!context) {
				throw new Error("Failed to create browser context");
			}
			const page = await context.newPage();

			// Suppress browser console warnings from TCAD website
			suppressBrowserConsoleWarnings(page);

			const response = await page.goto(
				"https://travis.prodigycad.com/property-search",
				{
					waitUntil: "domcontentloaded",
					timeout: 10000,
				},
			);

			await context.close();
			return response?.status() === 200;
		} catch (error) {
			logger.error("Connection test failed: %s", getErrorMessage(error));
			return false;
		} finally {
			await this.cleanup();
		}
	}
}

// Export a singleton instance for reuse
export const scraperInstance = new TCADScraper();
