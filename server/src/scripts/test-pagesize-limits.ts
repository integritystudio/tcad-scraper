import { chromium } from 'playwright';

/**
 * Test to find the maximum allowed page size for the TCAD API
 */
async function testPageSizeLimits() {
  console.log('🧪 Testing API Page Size Limits\n');
  console.log('=' .repeat(80) + '\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Get auth token
    console.log('Step 1: Obtaining authentication token...');

    let authToken: string | null = null;

    page.on('request', (request) => {
      const headers = request.headers();
      if (headers['authorization']) {
        authToken = headers['authorization'];
      }
    });

    await page.goto('https://travis.prodigycad.com/property-search', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    await page.waitForFunction(() => {
      const root = document.getElementById('root');
      return root && root.children.length > 0;
    }, { timeout: 15000 });

    await page.waitForSelector('#searchInput', { timeout: 10000 });
    await page.type('#searchInput', 'test', { delay: 50 });
    await page.press('#searchInput', 'Enter');
    await page.waitForTimeout(3000);

    if (!authToken) {
      throw new Error('Could not capture authorization token');
    }

    console.log('✅ Auth token obtained\n');

    // Test different page sizes
    console.log('Step 2: Testing different page sizes...\n');

    const pageSizesToTest = [20, 50, 100, 200, 500, 1000, 2000, 5000];
    const results: Array<{
      pageSize: number;
      success: boolean;
      resultsReturned: number;
      totalAvailable: number;
      responseTime: number;
      error?: string;
    }> = [];

    for (const pageSize of pageSizesToTest) {
      console.log(`Testing pageSize=${pageSize}...`);

      const startTime = Date.now();
      const result = await page.evaluate(async ({ token, size }: { token: string; size: number }) => {
        try {
          const apiUrl = `https://prod-container.trueprodigyapi.com/public/property/searchfulltext?page=1&pageSize=${size}`;

          const requestBody = {
            pYear: { operator: '=', value: '2025' },
            fullTextSearch: { operator: 'match', value: 'Smith' }
          };

          const res = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': token,
            },
            body: JSON.stringify(requestBody)
          });

          if (!res.ok) {
            return {
              success: false,
              error: `HTTP ${res.status}: ${await res.text()}`,
            };
          }

          const data = await res.json();
          return {
            success: true,
            resultsReturned: data.results?.length || 0,
            totalAvailable: data.totalProperty?.propertyCount || 0,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error.message,
          };
        }
      }, { token: authToken, size: pageSize });

      const responseTime = Date.now() - startTime;

      results.push({
        pageSize,
        success: result.success,
        resultsReturned: result.resultsReturned || 0,
        totalAvailable: result.totalAvailable || 0,
        responseTime,
        error: result.error,
      });

      if (result.success) {
        console.log(`  ✅ Success: Got ${result.resultsReturned} results in ${responseTime}ms`);
      } else {
        console.log(`  ❌ Failed: ${result.error}`);
      }

      // Small delay between requests
      await page.waitForTimeout(500);
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('RESULTS SUMMARY');
    console.log('='.repeat(80) + '\n');

    console.log('PageSize | Success | Results | Time (ms) | Status');
    console.log('-'.repeat(60));
    results.forEach(r => {
      const status = r.success ? '✅' : '❌';
      const results = r.success ? r.resultsReturned.toString().padEnd(7) : 'N/A'.padEnd(7);
      const time = r.responseTime.toString().padEnd(9);
      console.log(`${r.pageSize.toString().padEnd(8)} | ${status}      | ${results} | ${time} | ${r.error || 'OK'}`);
    });

    // Find optimal page size
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length > 0) {
      const maxPageSize = Math.max(...successfulResults.map(r => r.pageSize));
      const optimal = successfulResults.find(r => r.pageSize === maxPageSize);

      console.log('\n' + '='.repeat(80));
      console.log('RECOMMENDATION');
      console.log('='.repeat(80) + '\n');

      console.log(`✅ Maximum supported page size: ${maxPageSize}`);
      console.log(`✅ Results returned: ${optimal?.resultsReturned}`);
      console.log(`✅ Response time: ${optimal?.responseTime}ms`);
      console.log(`\nRecommended page size for production: ${Math.min(maxPageSize, 1000)}`);
      console.log('(Balance between result count and response time)');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await context.close();
    await browser.close();
  }
}

testPageSizeLimits();
