import logger from "./lib/logger";
import { getErrorMessage } from "./utils/error-helpers";
import { TCADScraper } from "./lib/tcad-scraper";

async function testApiScraper() {
	logger.info("Testing API-based scraper...\n");

	const scraper = new TCADScraper({
		headless: true, // Run headless for speed
	});

	try {
		await scraper.initialize();

		logger.info('Scraping properties for "Willow"...');
		const properties = await scraper.scrapePropertiesViaAPI("Willow");

		logger.info(`\n✅ Successfully scraped ${properties.length} properties\n`);

		if (properties.length > 0) {
			logger.info("First 3 properties:\n");
			properties.slice(0, 3).forEach((prop, index) => {
				logger.info(`Property ${index + 1}:`);
				logger.info(`  Property ID: ${prop.propertyId}`);
				logger.info(`  Owner: ${prop.name}`);
				logger.info(`  City: ${prop.city || "NOT FOUND"}`);
				logger.info(`  Address: ${prop.propertyAddress}`);
				logger.info(
					`  Appraised Value: $${prop.appraisedValue.toLocaleString()}`,
				);
				logger.info(`  Property Type: ${prop.propType}`);
				logger.info("");
			});

			// Check for city and appraised value coverage
			const withCity = properties.filter((p) => p.city).length;
			const withValue = properties.filter((p) => p.appraisedValue > 0).length;

			logger.info("\n📊 Data Quality:");
			logger.info(
				`  Properties with city: ${withCity}/${properties.length} (${Math.round((withCity / properties.length) * 100)}%)`,
			);
			logger.info(
				`  Properties with appraised value: ${withValue}/${properties.length} (${Math.round((withValue / properties.length) * 100)}%)`,
			);
		}
	} catch (error) {
		logger.error(
			`\n❌ Test failed: ${getErrorMessage(error)}`,
		);
	} finally {
		await scraper.cleanup();
	}
}

testApiScraper();
