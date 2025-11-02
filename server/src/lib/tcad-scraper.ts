import { chromium, Browser, Page, BrowserContext } from 'playwright';
import winston from 'winston';
import { ScraperConfig, PropertyData } from '../types';

const logger = winston.createLogger({
  level: 'info',
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
    // Configure Bright Data proxy if available
    // TEMPORARILY DISABLED: Proxy blocks React from rendering
    const proxyConfig = {}; // Disabled for testing
    /*
    const proxyConfig = process.env.BRIGHT_DATA_API_TOKEN ? {
      proxyServer: `http://${process.env.BRIGHT_DATA_PROXY_HOST || 'brd.superproxy.io'}:${process.env.BRIGHT_DATA_PROXY_PORT || '22225'}`,
      proxyUsername: `brd-customer-${process.env.BRIGHT_DATA_API_TOKEN?.substring(0, 8)}-zone-residential`,
      proxyPassword: process.env.BRIGHT_DATA_API_TOKEN,
    } : {};
    */

    this.config = {
      headless: true,
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 2000,
      userAgents: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ],
      viewports: [
        { width: 1920, height: 1080 },
        { width: 1366, height: 768 },
        { width: 1440, height: 900 },
      ],
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

  private async humanDelay(min: number = 100, max: number = 500): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min) + min);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  async scrapeProperties(searchTerm: string, maxRetries: number = 3): Promise<PropertyData[]> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Scraping attempt ${attempt} for search term: ${searchTerm}`);

        const context = await this.browser.newContext({
          userAgent: this.getRandomElement(this.config.userAgents),
          viewport: this.getRandomElement(this.config.viewports),
          locale: 'en-US',
          timezoneId: 'America/Chicago',
        });

        const page = await context.newPage();

        // Set additional headers to appear more legitimate
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        });

        try {
          // Navigate to the TCAD property search page (production environment)
          await page.goto('https://travis.prodigycad.com/property-search', {
            waitUntil: 'networkidle',
            timeout: this.config.timeout,
          });

          logger.info('Page loaded, waiting for React app...');

          // Wait for React to render content in the root div
          await page.waitForFunction(() => {
            const root = document.getElementById('root');
            return root && root.children.length > 0;
          }, { timeout: 15000 });

          logger.info('React app loaded, performing search...');

          // Use default year (2025) - no need to change
          // The TCAD website defaults to the current assessment year which has data
          await this.humanDelay(1000, 1500);

          // Log current year for debugging
          try {
            const yearInputs = await page.$$('.MuiSelect-nativeInput');
            const currentYear = yearInputs.length > 0 ? await yearInputs[yearInputs.length - 1].inputValue() : 'unknown';
            logger.info(`Using year: ${currentYear}`);
          } catch (error) {
            logger.warn('Could not determine year, using default');
          }

          // Wait for and fill the search input (use specific ID selector)
          await page.waitForSelector('#searchInput', { timeout: 10000 });

          // Add human-like typing delay
          await this.humanDelay(500, 1000);

          // Type with random delays between characters
          await page.type('#searchInput', searchTerm, { delay: 50 + Math.random() * 100 });

          // Add delay before pressing Enter
          await this.humanDelay(300, 700);

          await page.press('#searchInput', 'Enter');

          // Wait for search to initiate (the "No Rows" message appears immediately, so we need to wait for it to update)
          await this.humanDelay(2000, 3000);

          // Wait for either results to load or confirm no results after search completes
          await page.waitForFunction(
            () => {
              const hasGridCells = document.querySelector('[role="gridcell"]') !== null;
              const hasNoResults = document.querySelector('.ag-overlay-no-rows-center') !== null ||
                                  document.body.textContent?.includes('No Rows To Show');
              return hasGridCells || hasNoResults;
            },
            { timeout: 15000 }
          );

          // Additional wait to ensure grid is fully populated
          await this.humanDelay(1000, 1500);

          // Check if there are no results
          const hasNoResults = await page.evaluate(() => {
            // Check for no results AND no grid cells to confirm it's really empty
            const noResultsOverlay = document.querySelector('.ag-overlay-no-rows-center') !== null;
            const hasGridCells = document.querySelector('[role="gridcell"]') !== null;
            return noResultsOverlay && !hasGridCells;
          });

          if (hasNoResults) {
            logger.info('No results found for search term:', searchTerm);

            // Take screenshot for diagnostic purposes
            const timestamp = Date.now();
            const screenshotPath = `/home/aledlie/tcad-scraper/server/no-results-${searchTerm.replace(/[^a-z0-9]/gi, '_')}-${timestamp}.png`;
            await page.screenshot({ path: screenshotPath, fullPage: true });
            logger.info(`Screenshot saved to: ${screenshotPath}`);

            await context.close();
            return [];
          }

          logger.info('Results loaded, extracting data...');

          // Add delay before extracting data
          await this.humanDelay(1000, 2000);

          // Check if we need to scroll to load all columns
          const viewportWidth = await page.evaluate(() => window.innerWidth);
          const tableWidth = await page.evaluate(() => {
            const table = document.querySelector('[ref="eBodyViewport"]');
            return table ? table.scrollWidth : 0;
          });

          if (tableWidth > viewportWidth) {
            logger.info('Scrolling to load all columns...');
            await page.hover('[ref="eBodyViewport"]');
            await page.mouse.wheel({ deltaX: tableWidth });
            await this.humanDelay(500, 1000);
          }

          // Extract property data
          const properties = await page.evaluate(() => {
            const rows = document.querySelectorAll('.ag-row');
            const results = [];

            for (const row of rows) {
              // Extract text values directly
              const pidEl = row.querySelector('[col-id="pid"]');
              const propertyId = pidEl?.textContent?.trim() || '';

              const nameEl = row.querySelector('[col-id="displayName"]');
              const name = nameEl?.textContent?.trim() || '';

              const typeEl = row.querySelector('[col-id="propType"]');
              const propType = typeEl?.textContent?.trim() || '';

              const cityEl = row.querySelector('[col-id="city"]');
              const city = cityEl?.textContent?.trim() || null;

              const addrEl = row.querySelector('[col-id="streetPrimary"]');
              const propertyAddress = addrEl?.textContent?.trim() || '';

              const assessedEl = row.querySelector('.assessedValue');
              const assessedText = assessedEl?.textContent?.trim() || '';
              const assessedValue = assessedText ? parseFloat(assessedText.replace(/[$,]/g, '')) || 0 : 0;

              const appraisedEl = row.querySelector('[col-id="appraisedValue"]');
              const appraisedText = appraisedEl?.textContent?.trim() || '';
              const appraisedValue = appraisedText ? parseFloat(appraisedText.replace(/[$,]/g, '')) || 0 : 0;

              const geoEl = row.querySelector('[col-id="geoID"]');
              const geoId = geoEl?.textContent?.trim() || null;

              const descEl = row.querySelector('[col-id="legalDescription"]');
              const description = descEl?.textContent?.trim() || null;

              // Only include properties with address and ID
              if (propertyAddress && propertyId) {
                results.push({
                  propertyId,
                  name,
                  propType,
                  city,
                  propertyAddress,
                  assessedValue,
                  appraisedValue,
                  geoId,
                  description,
                });
              }
            }

            return results;
          });

          logger.info(`Extracted ${properties.length} properties`);

          // Take a screenshot for debugging (optional)
          if (process.env.NODE_ENV === 'development') {
            await page.screenshot({
              path: `screenshots/search_${searchTerm}_${Date.now()}.png`,
              fullPage: false
            });
          }

          return properties;

        } finally {
          await context.close();
        }

      } catch (error) {
        lastError = error as Error;
        logger.error(`Attempt ${attempt} failed:`, error);

        if (attempt < maxRetries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          logger.info(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('All scraping attempts failed');
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