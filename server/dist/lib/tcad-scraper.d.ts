import { ScraperConfig } from '../types';
export declare class TCADScraper {
    private browser;
    private config;
    constructor(config?: Partial<ScraperConfig>);
    initialize(): Promise<void>;
    private getRandomElement;
    private humanDelay;
    /**
     * Legacy DOM-based scraping method (DEPRECATED - use scrapePropertiesViaAPI instead)
     * Limited to 20 results per search due to hidden AG Grid pagination.
     */
    private discoverApiEndpoint;
    private scrapePropertyDetail;
    cleanup(): Promise<void>;
    testConnection(): Promise<boolean>;
}
export declare const scraperInstance: TCADScraper;
//# sourceMappingURL=tcad-scraper.d.ts.map