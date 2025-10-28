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
      ...config,
    };
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing browser...');
      this.browser = await chromium.launch({
        headless: this.config.headless,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--no-sandbox',
          '--disable-setuid-sandbox',
        ],
      });
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
          // Navigate to the TCAD property search page
          await page.goto('https://stage.travis.prodigycad.com/property-search', {
            waitUntil: 'networkidle',
            timeout: this.config.timeout,
          });

          logger.info('Page loaded, performing search...');

          // Wait for and fill the search input
          await page.waitForSelector('input[type="text"]', { timeout: 10000 });

          // Add human-like typing delay
          await this.humanDelay(500, 1000);

          // Type with random delays between characters
          await page.type('input[type="text"]', searchTerm, { delay: 50 + Math.random() * 100 });

          // Add delay before pressing Enter
          await this.humanDelay(300, 700);

          await page.press('input[type="text"]', 'Enter');

          // Wait for results to load
          await page.waitForSelector('[role="gridcell"]', {
            timeout: 20000,
            state: 'visible'
          });

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
            const rows = document.querySelectorAll('[aria-label="Press SPACE to select this row."][role="row"]');

            return Array.from(rows).map(row => {
              const extractText = (selector: string): string | null => {
                const element = row.querySelector(selector);
                return element?.textContent?.trim() || null;
              };

              const extractNumber = (selector: string): number => {
                const text = extractText(selector);
                if (!text) return 0;
                // Remove $ and commas, then parse
                const cleaned = text.replace(/[$,]/g, '');
                return parseFloat(cleaned) || 0;
              };

              return {
                propertyId: extractText('[col-id="pid"]') || '',
                name: extractText('[col-id="name"]') || '',
                propType: extractText('[col-id="propType"]') || '',
                city: extractText('[col-id="city"]'),
                propertyAddress: extractText('[col-id="streetPrimary"]') || '',
                assessedValue: extractNumber('.assessedValue'),
                appraisedValue: extractNumber('[col-id="appraisedValue"]'),
                geoId: extractText('[col-id="geoID"]'),
                description: extractText('[col-id="legalDescription"]'),
              };
            }).filter(property => property.propertyAddress && property.propertyId);
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

      const response = await page.goto('https://stage.travis.prodigycad.com/property-search', {
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