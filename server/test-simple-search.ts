import { chromium } from 'playwright';

async function testSimpleSearch() {
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

    await page.waitForTimeout(3000);

    // Don't change year - use whatever default
    const currentYear = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('.MuiSelect-nativeInput'));
      return inputs.length > 0 ? (inputs[inputs.length - 1] as HTMLInputElement).value : 'unknown';
    });
    console.log(`Current year (default): ${currentYear}`);

    // Try searching for just a number - property ID format
    console.log('Searching for "100000" (property ID)...');
    await page.type('#searchInput', '100000', { delay: 100 });
    await page.press('#searchInput', 'Enter');

    await page.waitForTimeout(5000);

    const hasResults = await page.evaluate(() => {
      return document.querySelector('[role="gridcell"]') !== null;
    });

    console.log(`Results for "100000": ${hasResults ? 'FOUND' : 'NONE'}`);

    if (!hasResults) {
      // Try a common street name
      await page.fill('#searchInput', '');
      await page.waitForTimeout(1000);
      console.log('Searching for "Main" (street)...');
      await page.type('#searchInput', 'Main', { delay: 100 });
      await page.press('#searchInput', 'Enter');
      await page.waitForTimeout(5000);

      const hasResults2 = await page.evaluate(() => {
        return document.querySelector('[role="gridcell"]') !== null;
      });
      console.log(`Results for "Main": ${hasResults2 ? 'FOUND' : 'NONE'}`);
    }

    await page.screenshot({ path: '/home/aledlie/tcad-scraper/server/test-simple-search.png', fullPage: true });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

testSimpleSearch();
