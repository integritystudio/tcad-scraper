import puppeteer from 'puppeteer';
import cheerio from 'cheerio';
import { insertProperties, getPropertyCount, closePool, Property } from './src/database.js';

const width = 1440;
const height = 900;

async function scrapePropertyTaxInformation() {
  const browser = await puppeteer.launch({
    headless: false,
    ignoreHTTPSErrors: true,
    args: [`--window-size=${width},${height}`]
  });
  const page = await browser.newPage();
  const url = 'https://stage.travis.prodigycad.com/property-search';
  const searchInput = 'dede';

  try {
    console.log('🔍 Starting scrape...');

    // Navigate to the TCAD website
    await page.goto(url, {waitUntil: "networkidle0"});

    // Input search term
    await page.type('input[type="text"]', searchInput);

    // Submit the search form
    await page.keyboard.press('Enter');

    // Wait for results to load
    await page.waitForSelector('[role="gridcell"]');

    // Parse result rows with Cheerio
    const info: Property[] = [];
    const htmlContent = await page.content();
    const $ = cheerio.load(htmlContent);
    const rows = $('[aria-label="Press SPACE to select this row."]').filter('[role="row"]');

    console.log(`📋 Found ${rows.length} rows`);

    // Extract property information
    rows.each((index, row) => {
      info.push({
        name: $(row).find('[col-id="name"]').text(),
        propType: $(row).find('[col-id="propType"]').text(),
        city: $(row).find('[col-id="city"]').text(),
        propertyAddress: $(row).find('[col-id="streetPrimary"]').text(),
        assessedValue: $(row).find('.assessedValue').text(),
        propertyID: $(row).find('[col-id="pid"]').text(),
        appraisedValue: $(row).find('[col-id="appraisedValue"]').text(),
        description: $(row).find('[col-id="legalDescription"]').text(),
        geoID: $(row).find('[col-id="geoID"]').text(),
      });
    });

    // Filter out empty results
    const validProperties = info.filter(elem => elem.propertyAddress !== '');
    console.log(`✓ Found ${validProperties.length} valid properties`);

    // Save to database
    if (validProperties.length > 0) {
      console.log('💾 Saving to database...');
      await insertProperties(validProperties);

      const totalCount = await getPropertyCount();
      console.log(`✓ Database now contains ${totalCount} total properties`);
    }

    console.log('\n📊 Sample of scraped data:');
    console.log(validProperties.slice(0, 3));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
    await closePool();
    console.log('✓ Done!');
  }
}

// Call the scraping function
scrapePropertyTaxInformation();
