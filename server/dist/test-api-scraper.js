"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tcad_scraper_1 = require("./lib/tcad-scraper");
async function testApiScraper() {
    console.log('Testing API-based scraper...\n');
    const scraper = new tcad_scraper_1.TCADScraper({
        headless: true, // Run headless for speed
    });
    try {
        await scraper.initialize();
        console.log('Scraping properties for "Willow"...');
        const properties = await scraper.scrapePropertiesViaAPI('Willow');
        console.log(`\n✅ Successfully scraped ${properties.length} properties\n`);
        if (properties.length > 0) {
            console.log('First 3 properties:\n');
            properties.slice(0, 3).forEach((prop, index) => {
                console.log(`Property ${index + 1}:`);
                console.log(`  Property ID: ${prop.propertyId}`);
                console.log(`  Owner: ${prop.name}`);
                console.log(`  City: ${prop.city || 'NOT FOUND'}`);
                console.log(`  Address: ${prop.propertyAddress}`);
                console.log(`  Appraised Value: $${prop.appraisedValue.toLocaleString()}`);
                console.log(`  Property Type: ${prop.propType}`);
                console.log('');
            });
            // Check for city and appraised value coverage
            const withCity = properties.filter(p => p.city).length;
            const withValue = properties.filter(p => p.appraisedValue > 0).length;
            console.log('\n📊 Data Quality:');
            console.log(`  Properties with city: ${withCity}/${properties.length} (${Math.round(withCity / properties.length * 100)}%)`);
            console.log(`  Properties with appraised value: ${withValue}/${properties.length} (${Math.round(withValue / properties.length * 100)}%)`);
        }
    }
    catch (error) {
        console.error('\n❌ Test failed:', error);
    }
    finally {
        await scraper.cleanup();
    }
}
testApiScraper();
//# sourceMappingURL=test-api-scraper.js.map