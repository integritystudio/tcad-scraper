import { chromium, Browser, Page } from 'playwright';
import winston from 'winston';
import { ScraperConfig, PropertyData } from '../types';
import { config as appConfig } from '../config';
import { scrapeDOMFallback } from './fallback/dom-scraper';
import { tokenRefreshService } from '../services/token-refresh.service';

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

    if (appConfig.scraper.brightData.enabled && appConfig.scraper.brightData.apiToken) {
      // Bright Data proxy configuration
      proxyConfig = {
        proxyServer: `http://${appConfig.scraper.brightData.proxyHost}:${appConfig.scraper.brightData.proxyPort}`,
        proxyUsername: `brd-customer-${appConfig.scraper.brightData.apiToken.substring(0, 8)}-zone-residential`,
        proxyPassword: appConfig.scraper.brightData.apiToken,
      };
      logger.info('Bright Data proxy configured');
    } else if (appConfig.scraper.proxy.enabled && appConfig.scraper.proxy.server) {
      // Generic proxy configuration
      proxyConfig = {
        proxyServer: appConfig.scraper.proxy.server,
        proxyUsername: appConfig.scraper.proxy.username,
        proxyPassword: appConfig.scraper.proxy.password,
      };
      logger.info('Generic proxy configured');
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
      logger.info(`Initializing browser${proxyEnabled ? ' with Bright Data proxy' : ''}...`);

      const launchOptions: any = {
        headless: this.config.headless,
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--no-sandbox',
          '--disable-setuid-sandbox',
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
      logger.info('Browser initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  private getRandomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  private async humanDelay(
    min: number = appConfig.scraper.humanDelay.min,
    max: number = appConfig.scraper.humanDelay.max
  ): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min) + min);
    await new Promise(resolve => setTimeout(resolve, delay));
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
  async scrapePropertiesViaAPI(searchTerm: string, maxRetries: number = 3): Promise<PropertyData[]> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`API scraping attempt ${attempt} for search term: ${searchTerm}`);

        const context = await this.browser.newContext({
          userAgent: this.getRandomElement(this.config.userAgents),
          viewport: this.getRandomElement(this.config.viewports),
          locale: 'en-US',
          timezoneId: 'America/Chicago',
        });

        const page = await context.newPage();

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
              logger.info('Using token from auto-refresh service');
            }
          }

          // Fall back to config token if refresh service doesn't have one
          if (!authToken) {
            authToken = appConfig.scraper.tcadApiKey || null;
          }

          if (authToken) {
            logger.info('Using pre-fetched TCAD_API_KEY from environment');
          } else {
            logger.info('No TCAD_API_KEY found, capturing token from browser...');

            page.on('request', (request) => {
              const headers = request.headers();
              const authHeader = headers['authorization'];

              // Only capture valid tokens (ignore "null" string and ensure it looks like a JWT)
              if (authHeader &&
                  authHeader !== 'null' &&
                  authHeader.length > 50 &&
                  authHeader.startsWith('eyJ') &&
                  !authToken) {
                authToken = authHeader;
                logger.info(`Auth token captured: length ${authToken.length}, preview: ${authToken.substring(0, 50)}...`);
              }
            });

            await page.goto('https://travis.prodigycad.com/property-search', {
              waitUntil: 'networkidle',
              timeout: this.config.timeout,
            });

            logger.info('Page loaded, waiting for React app...');

            await page.waitForFunction(() => {
              const root = document.getElementById('root');
              return root && root.children.length > 0;
            }, { timeout: 15000 });

            // Trigger a search to activate auth token
            await page.waitForSelector('#searchInput', { timeout: 10000 });
            await this.humanDelay(500, 1000);
            await page.type('#searchInput', 'test', { delay: 50 });
            await page.press('#searchInput', 'Enter');
            await this.humanDelay(3000, 4000); // Wait for API request to be made

            if (!authToken) {
              throw new Error('Failed to capture authorization token');
            }

            logger.info('Auth token captured from browser');
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
                      if (!r.ok) throw new Error('HTTP ' + r.status);
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

                      // Fetch remaining pages
                      function fetchNextPage() {
                        currentPage++;
                        if (allResults.length >= totalCount || currentPage > 100) {
                          resolve({ totalCount: totalCount, results: allResults, pageSize: pageSize });
                          return;
                        }

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
                          if (!r.ok) throw new Error('HTTP ' + r.status);
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
                          } else {
                            reject(err);
                          }
                        });
                      }

                      fetchNextPage();
                    })
                    .catch(function(err) {
                      if (err.message === 'TRUNCATED' || err.message.indexOf('JSON') >= 0) {
                        currentSizeIndex++;
                        lastErr = err.message;
                        tryNextPageSize();
                      } else {
                        reject(err);
                      }
                    });
                  }

                  tryNextPageSize();
                });
              };
            `
          });

          // Call the injected function
          const allProperties = await page.evaluate(`window.__tcad_search('${authToken}', '${searchTerm.replace(/'/g, "\\'")}')`) as any;

          logger.info(`API returned ${allProperties.totalCount} total properties, fetched ${allProperties.results.length} results (pageSize: ${allProperties.pageSize})`);

          // Step 3: Transform API response to PropertyData format
          const properties: PropertyData[] = allProperties.results.map((r: any) => ({
            propertyId: r.pid?.toString() || '',
            name: r.displayName || '',
            propType: r.propType || '',
            city: r.city || null,
            propertyAddress: r.streetPrimary || '',
            assessedValue: parseFloat(r.assessedValue) || 0,
            appraisedValue: parseFloat(r.appraisedValue) || 0,
            geoId: r.geoID || null,
            description: r.legalDescription || null,
          }));

          logger.info(`Extracted ${properties.length} properties via API`);

          return properties;

        } finally {
          await context.close();
        }

      } catch (error) {
        lastError = error as Error;
        logger.error(`API scraping attempt ${attempt} failed:`, error);

        if (attempt < maxRetries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
          logger.info(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('All API scraping attempts failed');
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
  async scrapePropertiesWithFallback(searchTerm: string, maxRetries: number = 3): Promise<PropertyData[]> {
    logger.info(`Starting scrape for: ${searchTerm}`);

    try {
      logger.info('🚀 Attempting primary method: API-based scraping');
      const properties = await this.scrapePropertiesViaAPI(searchTerm, maxRetries);
      logger.info(`✅ Primary method succeeded: Retrieved ${properties.length} properties`);
      return properties;
    } catch (apiError) {
      logger.error('❌ Primary API method failed after all retries:', apiError);
      logger.warn('🔄 Falling back to DOM-based scraping (limited to 20 results)');

      try {
        const properties = await scrapeDOMFallback(
          this.browser!,
          this.config,
          searchTerm,
          maxRetries
        );
        logger.info(`✅ Fallback method succeeded: Retrieved ${properties.length} properties (max 20)`);
        return properties;
      } catch (fallbackError) {
        logger.error('❌ Fallback method also failed:', fallbackError);
        throw new Error(
          `Both scraping methods failed. API error: ${(apiError as Error).message}. ` +
          `Fallback error: ${(fallbackError as Error).message}`
        );
      }
    }
  }

  /**
   * @deprecated Legacy DOM scraping method - moved to fallback/dom-scraper.ts
   * Use scrapePropertiesWithFallback() instead for automatic fallback support.
   *
   * The legacy scrapeProperties() method has been extracted to:
   * server/src/lib/fallback/dom-scraper.ts
   *
   * This keeps the main scraper file focused on the primary API method,
   * while the fallback mechanism is clearly separated and documented.
   */

  /**
   * Helper method to discover API endpoints (for debugging/development)
   */
  // @ts-expect-error - Intentional debug method kept for future use
  private async _discoverApiEndpoint(searchTerm: string): Promise<void> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const context = await this.browser.newContext({
      userAgent: this.getRandomElement(this.config.userAgents),
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();

    // Capture all network requests
    const apiRequests: Array<{ url: string; method: string; postData?: string; response?: any }> = [];

    page.on('request', (request) => {
      const url = request.url();
      // Look for API-like requests (JSON, contains "api", "search", "property", etc.)
      if (url.includes('api') || url.includes('search') || url.includes('property') || url.includes('data')) {
        apiRequests.push({
          url,
          method: request.method(),
          postData: request.postData() || undefined,
        });
        logger.info(`🔍 API Request: ${request.method()} ${url}`);
      }
    });

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('api') || url.includes('search') || url.includes('property') || url.includes('data')) {
        try {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('application/json')) {
            const json = await response.json();
            logger.info(`📦 API Response from ${url}:`, JSON.stringify(json).substring(0, 500));

            // Find matching request and attach response
            const matchingRequest = apiRequests.find(r => r.url === url && !r.response);
            if (matchingRequest) {
              matchingRequest.response = json;
            }
          }
        } catch (error) {
          // Response might not be JSON
        }
      }
    });

    try {
      // Navigate to search page
      await page.goto('https://stage.travis.prodigycad.com/property-search', {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      logger.info('Page loaded, performing search to trigger API calls...');

      // Wait for search input
      await page.waitForSelector('input[type="text"]', { timeout: 10000 });
      await this.humanDelay(500, 1000);

      // Type search term
      await page.type('input[type="text"]', searchTerm, { delay: 50 });
      await this.humanDelay(300, 700);

      // Submit search
      await page.press('input[type="text"]', 'Enter');

      // Wait for results or API calls
      await this.humanDelay(5000, 7000);

      logger.info(`\n=== API Discovery Summary ===`);
      logger.info(`Found ${apiRequests.length} API-like requests:`);

      for (const req of apiRequests) {
        logger.info(`\n  ${req.method} ${req.url}`);
        if (req.postData) {
          logger.info(`  POST Data: ${req.postData.substring(0, 200)}`);
        }
        if (req.response) {
          logger.info(`  Response Preview: ${JSON.stringify(req.response).substring(0, 300)}...`);
        }
      }

    } finally {
      await context.close();
    }
  }

  /**
   * Helper method to scrape property details (for debugging/development)
   */
  // @ts-expect-error - Intentional debug method kept for future use
  private async _scrapePropertyDetail(page: Page, propertyId: string): Promise<PropertyData | null> {
    try {
      // Navigate to property detail page
      const detailUrl = `https://stage.travis.prodigycad.com/property-detail?pid=${propertyId}`;
      await page.goto(detailUrl, {
        waitUntil: 'networkidle',
        timeout: 15000,
      });

      // Wait for content to load
      await this.humanDelay(1000, 2000);

      // Extract all property details from the detail page
      const propertyData = await page.evaluate(() => {
        // Helper function to get text content by label
        const getValueByLabel = (labelText: string): string | null => {
          // Try multiple selector strategies
          const labels = document.querySelectorAll('label, dt, th, .label, [class*="label"]');

          let labelIdx = 0;
          while (labelIdx < labels.length) {
            const label = labels[labelIdx];
            const text = label.textContent?.trim().toLowerCase() || '';

            if (text.includes(labelText.toLowerCase())) {
              // Try to find the associated value
              // Strategy 1: Next sibling
              let valueElem = label.nextElementSibling;
              if (valueElem && valueElem.textContent) {
                return valueElem.textContent.trim();
              }

              // Strategy 2: Parent's next sibling
              if (label.parentElement) {
                valueElem = label.parentElement.nextElementSibling;
                if (valueElem && valueElem.textContent) {
                  return valueElem.textContent.trim();
                }
              }

              // Strategy 3: Within same row (td after th)
              if (label.tagName === 'TH') {
                const row = label.closest('tr');
                if (row) {
                  const cells = row.querySelectorAll('td');
                  if (cells.length > 0) {
                    return cells[0].textContent?.trim() || null;
                  }
                }
              }
            }

            labelIdx++;
          }

          return null;
        };

        // Extract fields
        const name = getValueByLabel('owner') || getValueByLabel('name') || '';
        const propType = getValueByLabel('property type') || getValueByLabel('type') || '';
        const city = getValueByLabel('city') || getValueByLabel('situs city') || null;
        const propertyAddress = getValueByLabel('address') || getValueByLabel('situs address') || getValueByLabel('street') || '';

        // Parse appraised value
        const appraisedValueText = getValueByLabel('appraised value') ||
                                   getValueByLabel('market value') ||
                                   getValueByLabel('total value') || '0';
        const appraisedValue = parseFloat(appraisedValueText.replace(/[$,]/g, '')) || 0;

        // Parse assessed value
        const assessedValueText = getValueByLabel('assessed value') ||
                                  getValueByLabel('taxable value') || '0';
        const assessedValue = parseFloat(assessedValueText.replace(/[$,]/g, '')) || 0;

        const geoId = getValueByLabel('geo id') || getValueByLabel('geographic id') || null;
        const description = getValueByLabel('legal description') || getValueByLabel('description') || null;

        return {
          name,
          propType,
          city,
          propertyAddress,
          appraisedValue,
          assessedValue,
          geoId,
          description,
        };
      });

      // Return complete property data
      return {
        propertyId,
        ...propertyData,
      };

    } catch (error) {
      logger.error(`Error scraping detail page for property ${propertyId}:`, error);
      return null;
    }
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      logger.info('Closing browser...');
      await this.browser.close();
      this.browser = null;
      logger.info('Browser closed');
    }
  }

  // Helper method for health check
  async testConnection(): Promise<boolean> {
    try {
      await this.initialize();
      const context = await this.browser!.newContext();
      const page = await context.newPage();

      const response = await page.goto('https://travis.prodigycad.com/property-search', {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      });

      await context.close();
      return response?.status() === 200;
    } catch (error) {
      logger.error('Connection test failed:', error);
      return false;
    } finally {
      await this.cleanup();
    }
  }
}

// Export a singleton instance for reuse
export const scraperInstance = new TCADScraper();
