import { chromium } from 'playwright';

async function testWithAllYears() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('https://travis.prodigycad.com/property-search', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    await page.waitForFunction(() => {
      const root = document.getElementById('root');
      return root && root.children.length > 0;
    }, { timeout: 15000 });

    await page.waitForTimeout(2000);

    // Select "All" years
    console.log('Selecting "All" years...');
    const yearElements = await page.$$('.MuiSelect-root');
    if (yearElements.length > 0) {
      await yearElements[yearElements.length - 1].click();
      await page.waitForTimeout(1000);
      await page.locator('text=All').click();
      console.log('Selected "All" years');
      await page.waitForTimeout(2000);
    }

    // Search for 78701
    console.log('Searching for 78701...');
    await page.type('#searchInput', '78701', { delay: 100 });
    await page.press('#searchInput', 'Enter');

    // Wait for results
    await page.waitForFunction(
      () => {
        const hasGridCells = document.querySelector('[role="gridcell"]') !== null;
        const hasNoResults = document.querySelector('.ag-overlay-no-rows-center') !== null;
        return hasGridCells || hasNoResults;
      },
      { timeout: 20000 }
    );

    const hasResults = await page.evaluate(() => {
      return document.querySelector('[role="gridcell"]') !== null;
    });

    console.log(`Search results: ${hasResults ? 'FOUND RESULTS' : 'NO RESULTS'}`);

    if (hasResults) {
      const rowCount = await page.evaluate(() => {
        return document.querySelectorAll('.ag-row').length;
      });
      console.log(`Found ${rowCount} rows`);

      // Take screenshot
      await page.screenshot({ path: '/home/aledlie/tcad-scraper/server/test-all-years-results.png', fullPage: true });
      console.log('Screenshot saved');
    } else {
      await page.screenshot({ path: '/home/aledlie/tcad-scraper/server/test-all-years-no-results.png', fullPage: true });
      console.log('No results screenshot saved');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

testWithAllYears();
