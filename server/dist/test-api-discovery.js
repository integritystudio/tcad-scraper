"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const tcad_scraper_1 = require("./lib/tcad-scraper");
const logger_1 = __importDefault(require("../lib/logger"));
async function testApiDiscovery() {
    logger_1.default.info('Starting API discovery...');
    const scraper = new tcad_scraper_1.TCADScraper({
        headless: false, // Run with visible browser to see what's happening
    });
    try {
        await scraper.initialize();
        // Use the discoverApiEndpoint method via type assertion
        // @ts-ignore - accessing private method for testing
        await scraper.discoverApiEndpoint('Willow');
        logger_1.default.info('\n✅ API discovery complete!');
    }
    catch (error) {
        logger_1.default.error('❌ API discovery failed:', error);
    }
    finally {
        await scraper.cleanup();
    }
}
testApiDiscovery();
//# sourceMappingURL=test-api-discovery.js.map