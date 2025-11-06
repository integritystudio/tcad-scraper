import { chromium } from 'playwright';

async function testManualSearch() {
  console.log('Starting manual test...');
  const browser = await chromium.launch({ headless: false }); // Run in headed mode to see what's happening
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Navigating to TCAD...');
    await page.goto('https://travis.prodigycad.com/property-search', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    console.log('Waiting for React...');
    await page.waitForFunction(() => {
      const root = document.getElementById('root');
      return root && root.children.length > 0;
    }, { timeout: 15000 });

    await page.waitForTimeout(2000);

    // Check current year
    const yearInputs = await page.$$('.MuiSelect-nativeInput');
    const currentYear = yearInputs.length > 0 ? await yearInputs[yearInputs.length - 1].inputValue() : 'unknown';
    console.log(`Current year value: ${currentYear}`);

    // Try to click year dropdown and see what options are available
    await page.locator('text=' + currentYear).last().click();
    await page.waitForTimeout(1000);

    // Get all available year options
    const yearOptions = await page.evaluate(() => {
      const options = Array.from(document.querySelectorAll('[role="option"]'));
      return options.map(el => el.textContent?.trim());
    });
    console.log('Available year options:', yearOptions);

    // Select 2024 if available
    if (yearOptions.includes('2024')) {
      await page.locator('text=2024').click();
      console.log('Selected 2024');
      await page.waitForTimeout(2000);
    }

    // Try a simple search
    console.log('Searching for "Austin"...');
    await page.type('#searchInput', 'Austin', { delay: 100 });
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
    }

    console.log('\\nWaiting 30 seconds for manual inspection...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

testManualSearch();
