import { ScraperConfig, PropertyData } from '../types';
export declare class TCADScraper {
    private browser;
    private config;
    constructor(config?: Partial<ScraperConfig>);
    initialize(): Promise<void>;
    private getRandomElement;
    private humanDelay;
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
    scrapePropertiesViaAPI(searchTerm: string, maxRetries?: number): Promise<PropertyData[]>;
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
    scrapePropertiesWithFallback(searchTerm: string, maxRetries?: number): Promise<PropertyData[]>;
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
     * @internal Reserved for future debugging use
     */
    private _discoverApiEndpoint;
    /**
     * Helper method to scrape property details (for debugging/development)
     * @internal Reserved for future debugging use
     */
    private _scrapePropertyDetail;
    cleanup(): Promise<void>;
    testConnection(): Promise<boolean>;
}
export declare const scraperInstance: TCADScraper;
//# sourceMappingURL=tcad-scraper.d.ts.map