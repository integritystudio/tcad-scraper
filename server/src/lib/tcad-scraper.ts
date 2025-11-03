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
        { width: 3840, height: 2160 }, // 4K to see all columns
        { width: 2560, height: 1440 }, // 1440p
        { width: 1920, height: 1080 },
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

          logger.info('Results loaded, preparing to extract data...');

          // Add delay before scrolling
          await this.humanDelay(1000, 2000);

          // Step 1: Scroll down to results table
          logger.info('Scrolling down to results table...');
          await page.evaluate(() => {
            const firstRow = document.querySelector('[role="row"][row-index]');
            if (firstRow) {
              firstRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          });
          await this.humanDelay(500, 800);

          // Step 2: Try to show ALL columns using AG Grid API
          logger.info('Attempting to show all hidden columns...');

          // Try multiple aggressive methods to access AG Grid API and show all columns
          const columnsShown = await page.evaluate(() => {
            const debugInfo: any = {
              windowKeys: [],
              angularElements: 0,
              gridElements: 0,
              attempts: []
            };

            try {
              // Collect debug info about what's available
              debugInfo.windowKeys = Object.keys(window).filter(k =>
                k.toLowerCase().includes('ag') ||
                k.toLowerCase().includes('grid') ||
                k.toLowerCase().includes('angular')
              );

              debugInfo.angularElements = document.querySelectorAll('[ng-version], [ng-app], [ng-controller]').length;
              debugInfo.gridElements = document.querySelectorAll('[class*="ag-"], .ag-root, .ag-root-wrapper').length;

              // Method 1: Search window object for grid instances
              const windowGrid = (window as any).agGrid ||
                                (window as any).__agGrid ||
                                (window as any).__agGridAngularInstances ||
                                (window as any).gridOptions;

              if (windowGrid) {
                debugInfo.attempts.push({ method: 'window object', found: true });
                if (windowGrid.columnApi || windowGrid.api) {
                  const api = windowGrid.columnApi || windowGrid.api;
                  const allCols = api.getAllColumns ? api.getAllColumns() : api.getColumns();

                  if (allCols && allCols.length > 0) {
                    const hiddenCols: string[] = [];
                    let colIdx = 0;
                    while (colIdx < allCols.length) {
                      const col = allCols[colIdx];
                      const colId = col.colId || col.getColId();
                      const visible = col.visible !== undefined ? col.visible : col.isVisible();

                      if (!visible) {
                        hiddenCols.push(colId);
                        if (api.setColumnVisible) {
                          api.setColumnVisible(colId, true);
                        }
                      }
                      colIdx++;
                    }

                    return { success: true, shownColumns: hiddenCols, method: 'window object', debugInfo };
                  }
                }
              } else {
                debugInfo.attempts.push({ method: 'window object', found: false });
              }

              // Method 2: Search DOM elements for grid API
              const gridRoots = document.querySelectorAll('.ag-root, .ag-root-wrapper, [class*="ag-root"]');
              let rootIdx = 0;
              while (rootIdx < gridRoots.length) {
                const element = gridRoots[rootIdx] as any;
                debugInfo.attempts.push({ method: 'DOM element', index: rootIdx, found: !!element.__agGrid });

                if (element.__agGrid || element.gridOptions || element.__agComponent) {
                  const gridRef = element.__agGrid || element.gridOptions || element.__agComponent;

                  if (gridRef && (gridRef.columnApi || gridRef.api)) {
                    const api = gridRef.columnApi || gridRef.api;
                    const allCols = api.getAllColumns ? api.getAllColumns() : api.getColumns();

                    if (allCols && allCols.length > 0) {
                      const hiddenCols: string[] = [];
                      let colIdx = 0;
                      while (colIdx < allCols.length) {
                        const col = allCols[colIdx];
                        const colId = col.colId || col.getColId();
                        const visible = col.visible !== undefined ? col.visible : col.isVisible();

                        if (!visible) {
                          hiddenCols.push(colId);
                          if (api.setColumnVisible) {
                            api.setColumnVisible(colId, true);
                          }
                        }
                        colIdx++;
                      }

                      return { success: true, shownColumns: hiddenCols, method: 'DOM element', debugInfo };
                    }
                  }
                }
                rootIdx++;
              }

              // Method 3: Try to find and manipulate column state directly in DOM
              const headerCells = document.querySelectorAll('[role="columnheader"]');
              if (headerCells.length > 0) {
                debugInfo.attempts.push({ method: 'header manipulation', headerCount: headerCells.length });
                const headerColIds: string[] = [];
                let headerIdx = 0;
                while (headerIdx < headerCells.length) {
                  const header = headerCells[headerIdx];
                  const colId = header.getAttribute('col-id');
                  if (colId) {
                    headerColIds.push(colId);
                    // Try to make column visible by removing display:none or similar
                    const colElement = header.parentElement;
                    if (colElement) {
                      (colElement as HTMLElement).style.display = '';
                      (colElement as HTMLElement).style.width = 'auto';
                    }
                  }
                  headerIdx++;
                }

                if (headerColIds.length > 11) {
                  return {
                    success: true,
                    shownColumns: headerColIds.slice(11),
                    method: 'header manipulation',
                    debugInfo
                  };
                }
              }

              return {
                success: false,
                reason: 'All methods failed to find grid API',
                debugInfo
              };
            } catch (e) {
              return {
                success: false,
                reason: String(e),
                debugInfo
              };
            }
          });

          logger.info('Column visibility attempt:', JSON.stringify(columnsShown, null, 2));
          await this.humanDelay(1000, 1500);

          // Force the grid to render far-right columns using keyboard navigation
          logger.info('Using keyboard navigation to load all columns...');

          // Click on the first data cell to focus the grid
          await page.click('[role="gridcell"][col-id="pid"]').catch(() => {});
          await this.humanDelay(500, 800);

          // Press End key multiple times to jump to the rightmost column
          let endPresses = 0;
          while (endPresses < 20) {
            await page.keyboard.press('End');
            await this.humanDelay(200, 400);
            endPresses++;
          }

          // Wait for columns to render
          await this.humanDelay(2000, 3000);

          // Also try scrolling with mouse wheel
          await page.evaluate(() => {
            const viewport = document.querySelector('[role="presentation"]') ||
                            document.querySelector('.ag-body-viewport') ||
                            document.querySelector('[class*="viewport"]');

            if (viewport) {
              // Simulate many small scroll events to the right
              let scrollAmount = 0;
              while (scrollAmount < 5000) {
                viewport.scrollLeft += 100;
                scrollAmount += 100;
              }
            }
          });

          await this.humanDelay(2000, 3000);

          // Step 3: Scroll back to the left
          await page.evaluate(() => {
            let viewport = document.querySelector('[ref="eBodyViewport"]');
            if (!viewport) viewport = document.querySelector('.ag-body-viewport');
            if (!viewport) viewport = document.querySelector('[role="presentation"] > div');
            if (viewport) {
              viewport.scrollLeft = 0;
            }
          });
          await this.humanDelay(2000, 2500);

          logger.info('Scrolling complete, extracting data...');

          // Debug: Check ALL columns including those not currently visible
          const colDebug = await page.evaluate(() => {
            const firstDataRow = document.querySelector('[role="row"][row-index="0"]');
            if (!firstDataRow) return { error: 'No data rows found' };

            // Get all cells
            const cells = firstDataRow.querySelectorAll('[role="gridcell"]');
            const colIds = [];
            const cellData = [];

            let cellIdx = 0;
            while (cellIdx < cells.length) {
              const cell = cells[cellIdx];
              const colId = cell.getAttribute('col-id');
              const text = cell.textContent ? cell.textContent.trim().substring(0, 50) : '';

              if (colId) {
                colIds.push(colId);
                cellData.push({ colId, text, visible: cell.offsetWidth > 0 });
              }
              cellIdx++;
            }

            // Also check header row for all column definitions
            const headerCells = document.querySelectorAll('[role="columnheader"]');
            const headerColIds = [];
            let headerIdx = 0;
            while (headerIdx < headerCells.length) {
              const colId = headerCells[headerIdx].getAttribute('col-id');
              if (colId) headerColIds.push(colId);
              headerIdx++;
            }

            return {
              visibleColumns: colIds,
              totalCells: cells.length,
              cellSamples: cellData,
              headerColumns: headerColIds,
              totalHeaders: headerCells.length
            };
          });
          logger.info('Column analysis:', JSON.stringify(colDebug));

          // Extract property IDs from search results - we'll get full details from individual pages
          const propertyIds = await page.evaluate(() => {
            const rows = document.querySelectorAll('[role="row"][row-index]');
            const ids = [];

            let rowIndex = 0;
            while (rowIndex < rows.length) {
              const row = rows[rowIndex];
              const pidElem = row.querySelector('[col-id="pid"]');
              const propertyId = pidElem ? pidElem.textContent.trim() : '';

              if (propertyId) {
                ids.push(propertyId);
              }

              rowIndex++;
            }

            return ids;
          });

          logger.info(`Found ${propertyIds.length} property IDs, fetching details from individual pages...`);

          // Scrape each property's detail page
          const properties = [];
          let successCount = 0;
          let failCount = 0;

          for (let i = 0; i < propertyIds.length; i++) {
            const propertyId = propertyIds[i];

            try {
              logger.info(`Scraping property ${i + 1}/${propertyIds.length}: ${propertyId}`);

              const propertyData = await this.scrapePropertyDetail(page, propertyId);

              if (propertyData) {
                properties.push(propertyData);
                successCount++;
              } else {
                failCount++;
              }

              // Small delay between requests to avoid overwhelming the server
              await this.humanDelay(500, 1000);

            } catch (error) {
              logger.error(`Failed to scrape property ${propertyId}:`, error);
              failCount++;
            }
          }

          logger.info(`Detail scraping complete: ${successCount} succeeded, ${failCount} failed`);

          logger.info(`Extracted ${properties.length} properties`);

          // Take screenshots for debugging
          try {
            const fs = require('fs');
            if (!fs.existsSync('screenshots')) {
              fs.mkdirSync('screenshots', { recursive: true });
            }

            // Screenshot after scrolling to the right
            await page.evaluate((position) => {
              let viewport = document.querySelector('[ref="eBodyViewport"]');
              if (!viewport) viewport = document.querySelector('.ag-body-viewport');
              if (viewport) {
                viewport.scrollLeft = viewport.scrollWidth;
              }
            }, 1.0);
            await this.humanDelay(500, 800);

            await page.screenshot({
              path: `screenshots/search_${searchTerm}_right_${Date.now()}.png`,
              fullPage: false
            });

            // Screenshot at left position
            await page.evaluate(() => {
              let viewport = document.querySelector('[ref="eBodyViewport"]');
              if (!viewport) viewport = document.querySelector('.ag-body-viewport');
              if (viewport) {
                viewport.scrollLeft = 0;
              }
            });
            await this.humanDelay(300, 500);

            await page.screenshot({
              path: `screenshots/search_${searchTerm}_left_${Date.now()}.png`,
              fullPage: false
            });
          } catch (screenshotError) {
            logger.warn('Failed to take screenshot:', screenshotError);
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

  private async discoverApiEndpoint(searchTerm: string): Promise<void> {
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

  private async scrapePropertyDetail(page: Page, propertyId: string): Promise<PropertyData | null> {
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

  /**
   * Scrape properties using the discovered API endpoint within Playwright context
   * This method uses the browser's natural authentication flow and makes API calls from within the browser
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
          viewport: { width: 1920, height: 1080 },
          locale: 'en-US',
          timezoneId: 'America/Chicago',
        });

        const page = await context.newPage();

        // Set up response interception to capture the API data from the page's own search
        let apiResponseData: any = null;

        page.on('response', async (response) => {
          const url = response.url();
          if (url.includes('prod-container.trueprodigyapi.com/public/property/searchfulltext')) {
            try {
              const data = await response.json();
              apiResponseData = data;
              logger.info(`Intercepted API response with ${data.results?.length || 0} properties`);
            } catch (error) {
              logger.error('Failed to parse API response:', error);
            }
          }
        });

        try {
          // Navigate to the production site
          logger.info('Loading production site...');
          await page.goto('https://travis.prodigycad.com/property-search', {
            waitUntil: 'networkidle',
            timeout: this.config.timeout,
          });

          logger.info('Page loaded, performing search to intercept API response...');

          // Wait for search input
          await page.waitForSelector('input[type="text"]', { timeout: 10000 });
          await this.humanDelay(500, 1000);

          // Type the search term
          await page.type('input[type="text"]', searchTerm, { delay: 50 + Math.random() * 100 });
          await this.humanDelay(300, 700);

          // Submit search - this will trigger the API call which we'll intercept
          await page.press('input[type="text"]', 'Enter');

          // Wait for the API response to be intercepted
          logger.info('Waiting for API response...');
          await this.humanDelay(5000, 7000);

          if (!apiResponseData) {
            throw new Error('Failed to intercept API response from page search');
          }

          const apiResponse = apiResponseData;

          logger.info(`API returned ${apiResponse.totalProperty?.propertyCount || 0} total properties`);
          logger.info(`Retrieved ${apiResponse.results?.length || 0} properties in this batch`);

          if (!apiResponse.results || apiResponse.results.length === 0) {
            logger.warn('No properties found');
            return [];
          }

          // Log available fields from first property
          if (apiResponse.results.length > 0) {
            logger.info(`Available API fields: ${Object.keys(apiResponse.results[0]).join(', ')}`);
          }

          // Transform API results to our PropertyData format
          const properties: PropertyData[] = apiResponse.results.map((prop: any) => ({
            propertyId: String(prop.pid || ''),
            name: prop.displayName || prop.name || '',
            propType: prop.propType || '',
            city: prop.city || prop.addrCity || null,
            propertyAddress: prop.fullSitus || prop.streetPrimary || prop.addrDeliveryLine || '',
            appraisedValue: parseFloat(prop.appraisedValue || prop.marketValue || '0'),
            assessedValue: parseFloat(prop.landValue || '0') + parseFloat(prop.improvementValue || '0'),
            geoId: prop.geoID || prop.asCode || null,
            description: prop.legalDescription || null,
          }));

          logger.info(`Successfully transformed ${properties.length} properties`);

          await context.close();
          return properties;

        } catch (error) {
          await context.close();
          throw error;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.error(`Attempt ${attempt} failed:`, error);

        if (attempt < maxRetries) {
          const delay = this.config.retryDelay * attempt;
          logger.info(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Failed to scrape properties after all retries');
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