import { chromium } from 'playwright';

async function testYearSelection() {
  console.log('Starting browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Navigating to TCAD...');
    await page.goto('https://travis.prodigycad.com/property-search', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    console.log('Waiting for React to load...');
    await page.waitForFunction(() => {
      const root = document.getElementById('root');
      return root && root.children.length > 0;
    }, { timeout: 15000 });

    // Get all select elements
    const selectCount = await page.evaluate(() => document.querySelectorAll('select').length);
    console.log(`Found ${selectCount} select elements`);

    // Get current year value
    const currentYear = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const yearSelect = selects[selects.length - 1] as HTMLSelectElement;
      return yearSelect ? yearSelect.value : 'unknown';
    });
    console.log(`Current year value: ${currentYear}`);

    // Get all available year options
    const yearOptions = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const yearSelect = selects[selects.length - 1] as HTMLSelectElement;
      if (yearSelect) {
        const options = Array.from(yearSelect.options);
        return options.map(opt => ({ value: opt.value, text: opt.text }));
      }
      return [];
    });
    console.log('Available year options:', yearOptions);

    // Try to select 2024
    console.log('Attempting to select year 2024...');
    const selects = await page.$$('select');
    if (selects.length > 0) {
      const yearSelect = selects[selects.length - 1];
      await yearSelect.selectOption('2024');
      console.log('Select option executed');
    }

    // Wait a moment
    await page.waitForTimeout(2000);

    // Check year value after selection
    const newYear = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const yearSelect = selects[selects.length - 1] as HTMLSelectElement;
      return yearSelect ? yearSelect.value : 'unknown';
    });
    console.log(`Year value after selection: ${newYear}`);

    // Take screenshot
    await page.screenshot({ path: '/home/aledlie/tcad-scraper/server/test-year-select.png', fullPage: false });
    console.log('Screenshot saved');

    // Try a search with 78701
    console.log('\\nTrying search with 78701...');
    await page.waitForSelector('#searchInput', { timeout: 10000 });
    await page.type('#searchInput', '78701', { delay: 50 });
    await page.press('#searchInput', 'Enter');

    // Wait for results
    await page.waitForFunction(
      () => {
        const hasGridCells = document.querySelector('[role="gridcell"]') !== null;
        const hasNoResults = document.querySelector('.ag-overlay-no-rows-center') !== null ||
                            document.body.textContent?.includes('No Rows To Show');
        return hasGridCells || hasNoResults;
      },
      { timeout: 20000 }
    );

    // Check results
    const hasResults = await page.evaluate(() => {
      const gridCells = document.querySelectorAll('[role="gridcell"]');
      return gridCells.length > 0;
    });

    console.log(`Search results: ${hasResults ? 'FOUND RESULTS' : 'NO RESULTS'}`);

    // Take final screenshot
    await page.screenshot({ path: '/home/aledlie/tcad-scraper/server/test-search-results.png', fullPage: true });
    console.log('Final screenshot saved');

    console.log('\\nTest complete.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

testYearSelection();
