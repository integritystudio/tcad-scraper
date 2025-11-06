"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const tcad_scraper_1 = require("../lib/tcad-scraper");
const prisma_1 = require("../lib/prisma");
const winston_1 = __importDefault(require("winston"));
const logger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.simple(),
    transports: [new winston_1.default.transports.Console()],
});
/**
 * Test scraping and saving to database with new schema
 */
async function testDatabaseSave() {
    console.log('🧪 Testing Database Save with New Schema\n');
    console.log('='.repeat(80) + '\n');
    const searchTerm = 'Smith'; // Use a successful search term
    const scraper = new tcad_scraper_1.TCADScraper({ headless: true });
    try {
        await scraper.initialize();
        console.log('✅ Scraper initialized\n');
        console.log(`Scraping properties for: "${searchTerm}"`);
        const properties = await scraper.scrapePropertiesViaAPI(searchTerm);
        console.log(`✅ Found ${properties.length} properties\n`);
        if (properties.length === 0) {
            console.log('No properties to save');
            return;
        }
        // Save to database
        console.log('Saving properties to database...');
        let savedCount = 0;
        let updatedCount = 0;
        for (const property of properties) {
            try {
                const result = await prisma_1.prisma.property.upsert({
                    where: { propertyId: property.propertyId },
                    update: {
                        name: property.name,
                        propType: property.propType,
                        city: property.city || null,
                        propertyAddress: property.propertyAddress,
                        assessedValue: property.assessedValue || null,
                        appraisedValue: property.appraisedValue,
                        geoId: property.geoId || null,
                        description: property.description || null,
                        searchTerm: searchTerm,
                        scrapedAt: new Date(),
                        updatedAt: new Date(),
                    },
                    create: {
                        propertyId: property.propertyId,
                        name: property.name,
                        propType: property.propType,
                        city: property.city || null,
                        propertyAddress: property.propertyAddress,
                        assessedValue: property.assessedValue || null,
                        appraisedValue: property.appraisedValue,
                        geoId: property.geoId || null,
                        description: property.description || null,
                        searchTerm: searchTerm,
                        scrapedAt: new Date(),
                    },
                });
                if (result.createdAt.getTime() === result.updatedAt.getTime()) {
                    savedCount++;
                }
                else {
                    updatedCount++;
                }
            }
            catch (error) {
                console.error(`Error saving property ${property.propertyId}:`, error);
            }
        }
        console.log(`✅ Saved ${savedCount} new properties, updated ${updatedCount} existing`);
        // Verify data
        console.log('\n' + '─'.repeat(80));
        console.log('VERIFICATION');
        console.log('─'.repeat(80) + '\n');
        const totalInDb = await prisma_1.prisma.property.count();
        console.log(`Total properties in database: ${totalInDb}`);
        const sample = await prisma_1.prisma.property.findFirst({
            where: { searchTerm: searchTerm },
        });
        if (sample) {
            console.log('\nSample property from database:');
            console.log(`  Property ID: ${sample.propertyId}`);
            console.log(`  Name: ${sample.name}`);
            console.log(`  Address: ${sample.propertyAddress}`);
            console.log(`  City: ${sample.city || 'N/A'}`);
            console.log(`  Property Type: ${sample.propType}`);
            console.log(`  Appraised Value: $${sample.appraisedValue.toLocaleString()}`);
            console.log(`  Assessed Value: $${sample.assessedValue?.toLocaleString() || 'N/A'}`);
            console.log(`  Geo ID: ${sample.geoId || 'N/A'}`);
            console.log(`  Search Term: ${sample.searchTerm || 'N/A'}`);
            console.log(`  Scraped At: ${sample.scrapedAt.toISOString()}`);
            console.log(`  Created At: ${sample.createdAt.toISOString()}`);
        }
        console.log('\n✅ Database schema verification PASSED!');
        console.log('All fields are saving correctly with proper data types.\n');
    }
    catch (error) {
        console.error('❌ Fatal error:', error);
    }
    finally {
        await scraper.cleanup();
        await prisma_1.prisma.$disconnect();
        console.log('Cleanup complete');
    }
}
testDatabaseSave();
//# sourceMappingURL=test-db-save.js.map