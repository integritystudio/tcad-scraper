"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tcad_scraper_1 = require("../lib/tcad-scraper");
async function testPagination() {
    console.log('🧪 Testing pagination with search term that has many results...\n');
    const scraper = new tcad_scraper_1.TCADScraper();
    try {
        await scraper.initialize();
        // Use a common name that should return many results
        const searchTerm = 'Smith';
        console.log(`Searching for: "${searchTerm}" (should have many results)`);
        const properties = await scraper.scrapeProperties(searchTerm, 1);
        console.log(`\n✅ Found ${properties.length} properties!\n`);
        if (properties.length > 0) {
            console.log('First 3 properties:');
            properties.slice(0, 3).forEach((prop, i) => {
                console.log(`\n${i + 1}. ${prop.name}`);
                console.log(`   Address: ${prop.propertyAddress}`);
                console.log(`   Property ID: ${prop.propertyId}`);
                console.log(`   Appraised Value: $${prop.appraisedValue.toLocaleString()}`);
            });
            if (properties.length > 20) {
                console.log(`\n🎉 Pagination worked! Got ${properties.length} properties (more than default 20)`);
            }
            else {
                console.log(`\n⚠️ Only got ${properties.length} properties (may not have triggered pagination)`);
            }
        }
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
    finally {
        await scraper.cleanup();
    }
}
testPagination();
//# sourceMappingURL=test-pagination.js.map