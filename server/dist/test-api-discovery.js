"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tcad_scraper_1 = require("./lib/tcad-scraper");
async function testApiDiscovery() {
    console.log('Starting API discovery...');
    const scraper = new tcad_scraper_1.TCADScraper({
        headless: false, // Run with visible browser to see what's happening
    });
    try {
        await scraper.initialize();
        // Use the discoverApiEndpoint method via type assertion
        // @ts-ignore - accessing private method for testing
        await scraper.discoverApiEndpoint('Willow');
        console.log('\n✅ API discovery complete!');
    }
    catch (error) {
        console.error('❌ API discovery failed:', error);
    }
    finally {
        await scraper.cleanup();
    }
}
testApiDiscovery();
//# sourceMappingURL=test-api-discovery.js.map