import * as cheerio from "cheerio";
import puppeteer from "puppeteer";
import {
	closePool,
	getPropertyCount,
	insertProperties,
	type Property,
} from "./src/database.js";

const width = 1440;
const height = 900;

async function scrapePropertyTaxInformation() {
	const browser = await puppeteer.launch({
		headless: true,
		ignoreHTTPSErrors: true,
		args: [
			`--window-size=${width},${height}`,
			"--no-sandbox",
			"--disable-setuid-sandbox",
		],
	});
	const page = await browser.newPage();
	const url = "https://stage.travis.prodigycad.com/property-search";
	const searchInput = "dede";

	try {
		console.log("🔍 Starting scrape...");

		// Navigate to the TCAD website
		await page.goto(url, { waitUntil: "networkidle0" });

		// Input search term
		await page.type('input[type="text"]', searchInput);

		// Submit the search form
		await page.keyboard.press("Enter");

		// Wait for results to load
		await page.waitForSelector('[role="gridcell"]');

		// Parse result rows with Cheerio
		const info: Property[] = [];
		const htmlContent = await page.content();
		const $ = cheerio.load(htmlContent);

		// Find all rows that contain gridcells (data rows, not header rows)
		const rows = $('[role="row"]').filter((_i, row) => {
			return $(row).find('[role="gridcell"]').length > 0;
		});

		console.log(`📋 Found ${rows.length} data rows`);

		// Extract property information using available col-ids
		rows.each((_index, row) => {
			const propertyData = {
				name: $(row).find('[col-id="displayName"]').text().trim(), // Owner name
				propType: $(row).find('[col-id="propType"]').text().trim(),
				city: "", // Not available in this view
				propertyAddress: "", // Not available in this view
				assessedValue: "", // Not available in this view
				propertyID: $(row).find('[col-id="pid"]').text().trim(),
				appraisedValue: "", // Not available in this view
				description: $(row).find('[col-id="refID1"]').text().trim(), // Using refID1 as description
				geoID: $(row).find('[col-id="geoID"]').text().trim(),
			};

			info.push(propertyData);
		});

		// Filter out empty results - use propertyID since address is not available in this view
		const validProperties = info.filter((elem) => elem.propertyID !== "");
		console.log(`✓ Found ${validProperties.length} valid properties`);

		// Save to database
		if (validProperties.length > 0) {
			console.log("💾 Saving to database...");
			await insertProperties(validProperties);

			const totalCount = await getPropertyCount();
			console.log(`✓ Database now contains ${totalCount} total properties`);
		}

		console.log("\n📊 Sample of scraped data:");
		console.log(validProperties.slice(0, 3));
	} catch (error) {
		console.error("❌ Error:", error);
	} finally {
		await browser.close();
		await closePool();
		console.log("✓ Done!");
	}
}

// Call the scraping function
scrapePropertyTaxInformation();
