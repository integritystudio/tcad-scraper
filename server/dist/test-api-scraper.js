"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const tcad_scraper_1 = require("./lib/tcad-scraper");
const logger_1 = __importDefault(require("../lib/logger"));
async function testApiScraper() {
    logger_1.default.info('Testing API-based scraper...\n');
    const scraper = new tcad_scraper_1.TCADScraper({
        headless: true, // Run headless for speed
    });
    try {
        await scraper.initialize();
        logger_1.default.info('Scraping properties for "Willow"...');
        const properties = await scraper.scrapePropertiesViaAPI('Willow');
        logger_1.default.info(`\n✅ Successfully scraped ${properties.length} properties\n`);
        if (properties.length > 0) {
            logger_1.default.info('First 3 properties:\n');
            properties.slice(0, 3).forEach((prop, index) => {
                logger_1.default.info(`Property ${index + 1}:`);
                logger_1.default.info(`  Property ID: ${prop.propertyId}`);
                logger_1.default.info(`  Owner: ${prop.name}`);
                logger_1.default.info(`  City: ${prop.city || 'NOT FOUND'}`);
                logger_1.default.info(`  Address: ${prop.propertyAddress}`);
                logger_1.default.info(`  Appraised Value: $${prop.appraisedValue.toLocaleString()}`);
                logger_1.default.info(`  Property Type: ${prop.propType}`);
                logger_1.default.info('');
            });
            // Check for city and appraised value coverage
            const withCity = properties.filter(p => p.city).length;
            const withValue = properties.filter(p => p.appraisedValue > 0).length;
            logger_1.default.info('\n📊 Data Quality:');
            logger_1.default.info(`  Properties with city: ${withCity}/${properties.length} (${Math.round(withCity / properties.length * 100)}%)`);
            logger_1.default.info(`  Properties with appraised value: ${withValue}/${properties.length} (${Math.round(withValue / properties.length * 100)}%)`);
        }
    }
    catch (error) {
        logger_1.default.error('\n❌ Test failed:', error);
    }
    finally {
        await scraper.cleanup();
    }
}
testApiScraper();
//# sourceMappingURL=test-api-scraper.js.map