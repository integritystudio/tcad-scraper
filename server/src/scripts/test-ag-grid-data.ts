import { chromium } from 'playwright';

async function testAGGridData() {
  console.log('🔍 Testing AG Grid data extraction...\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('https://travis.prodigycad.com/property-search', {
      waitUntil: 'networkidle',
    });

    await page.waitForFunction(() => {
      const root = document.getElementById('root');
      return root && root.children.length > 0;
    }, { timeout: 15000 });

    await page.waitForSelector('#searchInput', { timeout: 10000 });
    await page.type('#searchInput', 'Smith', { delay: 100 });
    await page.press('#searchInput', 'Enter');
    await page.waitForTimeout(3000);

    await page.waitForFunction(
      () => document.querySelector('[role="gridcell"]') !== null,
      { timeout: 15000 }
    );

    console.log('Results loaded, checking AG Grid data sources...\n');

    const dataInfo = await page.evaluate(() => {
      return {
        visibleRows: document.querySelectorAll('.ag-row').length,
        totalElements: document.querySelectorAll('[class*="ag-"]').length,
      };
    });

    console.log('Visible rows:', dataInfo.visibleRows);
    console.log('Grid APIs found:', dataInfo.gridAPIs.length);
    console.log('Data extracted:', dataInfo.dataFound);
    console.log('Total data items:', dataInfo.allData.length);

    if (dataInfo.allData.length > 0) {
      console.log('\n✅ Found data! Sample:');
      console.log(JSON.stringify(dataInfo.allData.slice(0, 3), null, 2));
    } else {
      console.log('\n❌ Could not extract data from AG Grid internal model');
      console.log('Grid API locations found:', JSON.stringify(dataInfo.gridAPIs, null, 2));
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await context.close();
    await browser.close();
  }
}

testAGGridData();
