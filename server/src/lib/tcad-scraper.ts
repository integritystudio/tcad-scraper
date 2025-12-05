import { type Browser, chromium, type LaunchOptions } from "playwright";
import winston from "winston";
import { config as appConfig } from "../config";
import { tokenRefreshService } from "../services/token-refresh.service";
import type { PropertyData, ScraperConfig } from "../types";
import { suppressBrowserConsoleWarnings } from "../utils/browser-console-suppression";
import { scrapeDOMFallback } from "./fallback/dom-scraper";

interface TCADApiResponse {
	totalCount: number;
	results: TCADPropertyResult[];
	pageSize: number;
}

interface TCADPropertyResult {
	pid?: number;
	displayName?: string;
	propType?: string;
	city?: string;
	streetPrimary?: string;
	assessedValue?: string | number;
	appraisedValue?: string | number;
	geoID?: string;
	legalDescription?: string;
}

const logger = winston.createLogger({
	level: appConfig.logging.level,
	format: winston.format.json(),
	transports: [
		new winston.transports.Console({
			format: winston.format.simple(),
		}),
	],
});

export class TCADScraper {
	private browser: Browser | null = null;
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
		try {
			const proxyEnabled = !!this.config.proxyServer;
			logger.info(
				`Initializing browser${proxyEnabled ? " with Bright Data proxy" : ""}...`,
			);

			const launchOptions: LaunchOptions = {
				headless: this.config.headless,
				executablePath:
					process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
				args: [
					"--disable-blink-features=AutomationControlled",
					"--disable-web-security",
					"--disable-features=IsolateOrigins,site-per-process",
					"--no-sandbox",
					"--disable-setuid-sandbox",
				],
			};

			// Add proxy configuration if available
			if (this.config.proxyServer) {
				launchOptions.proxy = {
					server: this.config.proxyServer,
					username: this.config.proxyUsername,
					password: this.config.proxyPassword,
				};
				logger.info(`Using proxy: ${this.config.proxyServer}`);
			}

			this.browser = await chromium.launch(launchOptions);
			logger.info("Browser initialized successfully");
		} catch (error) {
			logger.error("Failed to initialize browser:", error);
			throw error;
		}
	}

	private getRandomElement<T>(array: T[]): T {
		return array[Math.floor(Math.random() * array.length)];
	}

	private async humanDelay(
		min: number = appConfig.scraper.humanDelay.min,
		max: number = appConfig.scraper.humanDelay.max,
	): Promise<void> {
		const delay = Math.floor(Math.random() * (max - min) + min);
		await new Promise((resolve) => setTimeout(resolve, delay));
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
		if (!this.browser) {
			throw new Error("Browser not initialized. Call initialize() first.");
		}

		let lastError: Error | null = null;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				logger.info(
					`API scraping attempt ${attempt} for search term: ${searchTerm}`,
				);

				const context = await this.browser.newContext({
					userAgent: this.getRandomElement(this.config.userAgents),
					viewport: this.getRandomElement(this.config.viewports),
					locale: "en-US",
					timezoneId: "America/Chicago",
				});

				const page = await context.newPage();

				// Suppress browser console warnings from TCAD website
				suppressBrowserConsoleWarnings(page, logger);

				try {
					// Step 1: Get auth token - priority order:
					// 1. Token from auto-refresh service (if enabled)
					// 2. Token from environment/config
					// 3. Capture from browser (fallback)
					let authToken: string | null = null;

					// Try to get token from refresh service first (if auto-refresh is enabled)
					if (appConfig.scraper.autoRefreshToken) {
						authToken = tokenRefreshService.getCurrentToken();
						if (authToken) {
							logger.info("Using token from auto-refresh service");
						}
					}

					// Fall back to config token if refresh service doesn't have one
					if (!authToken) {
						authToken = appConfig.scraper.tcadApiKey || null;
					}

					if (authToken) {
						logger.info("Using pre-fetched TCAD_API_KEY from environment");
					} else {
						logger.info(
							"No TCAD_API_KEY found, capturing token from browser...",
						);

						page.on("request", (request) => {
							const headers = request.headers();
							const authHeader = headers.authorization;

							// Only capture valid tokens (ignore "null" string and ensure it looks like a JWT)
							if (
								authHeader &&
								authHeader !== "null" &&
								authHeader.length > 50 &&
								authHeader.startsWith("eyJ") &&
								!authToken
							) {
								authToken = authHeader;
								logger.info(
									`Auth token captured: length ${authToken.length}, preview: ${authToken.substring(0, 50)}...`,
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

						// Trigger a search to activate auth token
						await page.waitForSelector("#searchInput", { timeout: 10000 });
						await this.humanDelay(500, 1000);
						await page.type("#searchInput", "test", { delay: 50 });
						await page.press("#searchInput", "Enter");
						await this.humanDelay(3000, 4000); // Wait for API request to be made

						if (!authToken) {
							throw new Error("Failed to capture authorization token");
						}

						logger.info("Auth token captured from browser");
					}

					// Step 2: Make API calls from browser context using string injection to avoid tsx transformation
					// Inject function as raw string to bypass __name issues
					await page.addScriptTag({
						content: `
              window.__tcad_search = function(token, term) {
                const apiUrl = 'https://prod-container.trueprodigyapi.com/public/property/searchfulltext';
                const pageSizes = [1000, 500, 100, 50];
                let currentSizeIndex = 0;
                let lastErr = '';
                const RATE_LIMIT_DELAY = 1000; // 1 second delay between requests to avoid 409

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

                    // Fetch first page
                    fetch(apiUrl + '?page=1&pageSize=' + pageSize, {
                      method: 'POST',
                      headers: {
                        'Authorization': token,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                      },
                      body: JSON.stringify({
                        pYear: { operator: '=', value: '2025' },
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

                      // Fetch remaining pages with rate-limit delay
                      function fetchNextPage() {
                        currentPage++;
                        if (allResults.length >= totalCount || currentPage > 100) {
                          resolve({ totalCount: totalCount, results: allResults, pageSize: pageSize });
                          return;
                        }

                        // Add delay between pagination requests to avoid rate limiting
                        setTimeout(function() {
                          fetch(apiUrl + '?page=' + currentPage + '&pageSize=' + pageSize, {
                          method: 'POST',
                          headers: {
                            'Authorization': token,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                          },
                          body: JSON.stringify({
                            pYear: { operator: '=', value: '2025' },
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
                            // Auth token expired - reject with special error for queue to handle
                            reject(new Error('TOKEN_EXPIRED: Authorization token expired, needs refresh'));
                          } else if (err.message.indexOf('HTTP 409') >= 0) {
                            // Rate limit hit - wait longer before retrying
                            setTimeout(function() {
                              fetchNextPage();
                            }, RATE_LIMIT_DELAY * 2); // Wait 2 seconds before retry
                          } else if (err.message.indexOf('GATEWAY_TIMEOUT') >= 0) {
                            // Gateway timeout - wait and retry with backoff
                            setTimeout(function() {
                              fetchNextPage();
                            }, RATE_LIMIT_DELAY * 5); // Wait 5 seconds before retry
                          } else {
                            reject(err);
                          }
                        });
                        }, RATE_LIMIT_DELAY); // Close the setTimeout for pagination delay
                      }

                      fetchNextPage();
                    })
                    .catch(function(err) {
                      if (err.message === 'TRUNCATED' || err.message.indexOf('JSON') >= 0) {
                        currentSizeIndex++;
                        lastErr = err.message;
                        tryNextPageSize();
                      } else if (err.message.indexOf('TOKEN_EXPIRED') >= 0) {
                        // Auth token expired - reject with special error for queue to handle
                        reject(new Error('TOKEN_EXPIRED: Authorization token expired, needs refresh'));
                      } else if (err.message.indexOf('HTTP 409') >= 0) {
                        // Rate limit hit on first page - wait longer before retrying with different page size
                        setTimeout(function() {
                          currentSizeIndex++;
                          lastErr = err.message;
                          tryNextPageSize();
                        }, RATE_LIMIT_DELAY * 3); // Wait 3 seconds before trying different page size
                      } else if (err.message.indexOf('GATEWAY_TIMEOUT') >= 0) {
                        // Gateway timeout on first page - wait and try with smaller page size
                        setTimeout(function() {
                          currentSizeIndex++;
                          lastErr = err.message;
                          tryNextPageSize();
                        }, RATE_LIMIT_DELAY * 5); // Wait 5 seconds before trying smaller page size
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

					// Call the injected function
					const allProperties = (await page.evaluate(
						`window.__tcad_search('${authToken}', '${searchTerm.replace(/'/g, "\\'")}')`,
					)) as TCADApiResponse;

					logger.info(
						`API returned ${allProperties.totalCount} total properties, fetched ${allProperties.results.length} results (pageSize: ${allProperties.pageSize})`,
					);

					// Step 3: Transform API response to PropertyData format
					const properties: PropertyData[] = allProperties.results.map(
						(r: TCADPropertyResult) => ({
							propertyId: r.pid?.toString() || "",
							name: r.displayName || "",
							propType: r.propType || "",
							city: r.city || null,
							propertyAddress: r.streetPrimary || "",
							assessedValue:
								typeof r.assessedValue === "number"
									? r.assessedValue
									: parseFloat(String(r.assessedValue || 0)),
							appraisedValue:
								typeof r.appraisedValue === "number"
									? r.appraisedValue
									: parseFloat(String(r.appraisedValue || 0)),
							geoId: r.geoID || null,
							description: r.legalDescription || null,
						}),
					);

					logger.info(`Extracted ${properties.length} properties via API`);

					return properties;
				} finally {
					await context.close();
				}
			} catch (error) {
				lastError = error as Error;
				logger.error(`API scraping attempt ${attempt} failed:`, error);

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
			logger.info("🚀 Attempting primary method: API-based scraping");
			const properties = await this.scrapePropertiesViaAPI(
				searchTerm,
				maxRetries,
			);
			logger.info(
				`✅ Primary method succeeded: Retrieved ${properties.length} properties`,
			);
			return properties;
		} catch (apiError) {
			logger.error("❌ Primary API method failed after all retries:", apiError);
			logger.warn(
				"🔄 Falling back to DOM-based scraping (limited to 20 results)",
			);

			try {
				const properties = await scrapeDOMFallback(
					this.browser!,
					this.config,
					searchTerm,
					maxRetries,
				);
				logger.info(
					`✅ Fallback method succeeded: Retrieved ${properties.length} properties (max 20)`,
				);
				return properties;
			} catch (fallbackError) {
				logger.error("❌ Fallback method also failed:", fallbackError);
				throw new Error(
					`Both scraping methods failed. API error: ${(apiError as Error).message}. ` +
						`Fallback error: ${(fallbackError as Error).message}`,
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
			logger.error("Connection test failed:", error);
			return false;
		} finally {
			await this.cleanup();
		}
	}
}

// Export a singleton instance for reuse
export const scraperInstance = new TCADScraper();
