import puppeteer from 'puppeteer';
import cheerio from 'cheerio';

const { PendingXHR } = require('pending-xhr-puppeteer');

const width = 1440;
const height = 900;

interface property {
  name: string,
  propType: string,
  city: string | null | undefined,
  propertyAddress: string,
  assessedValue: string,
  propertyID: string,
  appraisedValue: string,
  geoID: string | null | undefined,
  description: string | null | undefined,

}

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
    // Navigate to the TCAD website, wait till it all loads
    await page.goto(url, {waitUntil: "networkidle0"});

    // Input 'abcd' into the search field
    await page.type('input[type="text"]', 'dede');

    // Submit the search form
    await page.keyboard.press('Enter');

    // wait for columns to load
    await page.waitForSelector('[role="gridcell"]');

//    await page.screenshot({ path: 'results.png' });

    // parse result rows with Cheerio
    const info : property[] = [];
    const htmlContent = await page.content();
    const $ = cheerio.load(htmlContent);
    const rows = $('[aria-label="Press SPACE to select this row."]').filter('[role="row"]');

    // Extract property tax information for the ten most valuable properties (modify selectors accordingly)
    rows.each((index, row)=> {
      const val = $(row).find('[col-id="appraisedValue"]');
//      console.log(val.text());
      info.push({
        name: $(row).find('[col-id="name"]').text(),
        propType: $(row).find('[col-id="propType"]').text(),
        city: $(row).find('[col-id="city"]').text(),
        propertyAddress: $(row).find('[col-id="streetPrimary"]').text(),
        assessedValue: $(row).find('.assessedValue').text(),
        propertyID: $(row).find('[col-id="pid"]').text(),
        appraisedValue: val.text(),
        description: $(row).find('[col-id="legalDescription"]').text(),
        geoID : $(row).find('[col-id="geoID"]').text(),
      });
    });
    const realInfo = info.filter(elem => elem.propertyAddress != '' );
    console.log(realInfo);

    //TODO: make this work for all rows by creating dict
/*
    // Scroll all the way to the right of results table to make all columns load
    await page.hover('[ref="eBodyViewport"]');
    await page.mouse.wheel({deltaX: 1440})

    // TODO: use dynamic page.availWidth and cast
    const availWidth = await page.evaluate('window.screen.availWidth');
    console.log(availWidth);


    // wait for all columns to load
    await page.waitForSelector('[col-id="appraisedValue"]');
    // take a screenshot of results for debugging
*/
  } catch (error) {
    console.error('Error:', error);
  } finally {
//    await browser.close();
  }
}

//TODO : implement
/*
function extract(string colName, Element row) => {
  return $(row).find('col-id="'+colName+'"');
}
*/

// Call the scraping function
scrapePropertyTaxInformation();
