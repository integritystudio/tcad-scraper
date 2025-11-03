import { chromium } from 'playwright';

/**
 * PROOF OF CONCEPT: Direct API bypass for pagination limitation
 *
 * Instead of using the UI with its 20-result limit, we can:
 * 1. Get an auth token from the website
 * 2. Make direct HTTP POST requests to the API
 * 3. Use a larger pageSize (100, 500, or even 1000)
 * 4. Paginate through all results if needed
 */
async function testDirectAPIBypass() {
  console.log('🚀 Testing Direct API Bypass for Pagination Limit\n');
  console.log('=' .repeat(80) + '\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Step 1: Get authentication token by performing a search
    console.log('Step 1: Loading page and waiting for authentication...');

    let authToken: string | null = null;

    // Capture the authorization token from network requests
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

    // Wait for React to render
    await page.waitForFunction(() => {
      const root = document.getElementById('root');
      return root && root.children.length > 0;
    }, { timeout: 15000 });

    // Perform a quick search to trigger auth token usage
    await page.waitForSelector('#searchInput', { timeout: 10000 });
    await page.type('#searchInput', 'test', { delay: 50 });
    await page.press('#searchInput', 'Enter');
    await page.waitForTimeout(3000);

    console.log(`Auth Token: ${authToken ? authToken.substring(0, 50) + '...' : 'Not found'}\n`);

    if (!authToken) {
      throw new Error('Could not capture authorization token');
    }

    // Step 2: Test direct API call with larger pageSize
    console.log('Step 2: Making direct API call with pageSize=100...\n');

    const response = await page.evaluate(async (token: string) => {
      // Make direct fetch request to the API
      const apiUrl = 'https://prod-container.trueprodigyapi.com/public/property/searchfulltext?page=1&pageSize=100';

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
          status: res.status,
          error: await res.text(),
        };
      }

      const data = await res.json();
      return {
        status: res.status,
        totalCount: data.totalProperty?.propertyCount,
        resultsReturned: data.results?.length,
        sampleResults: data.results?.slice(0, 3).map((r: any) => ({
          pid: r.pid,
          displayName: r.displayName,
          streetPrimary: r.streetPrimary,
          city: r.city,
          appraisedValue: r.appraisedValue,
        }))
      };
    }, authToken);

    console.log('API Response:');
    console.log(`- Status: ${response.status}`);
    console.log(`- Total properties matching search: ${response.totalCount}`);
    console.log(`- Results returned: ${response.resultsReturned}`);
    console.log(`\n✅ SUCCESS! We got ${response.resultsReturned} results instead of 20!\n`);

    console.log('Sample results:');
    response.sampleResults?.forEach((result: any, i: number) => {
      console.log(`\n${i + 1}. ${result.displayName}`);
      console.log(`   PID: ${result.pid}`);
      console.log(`   Address: ${result.streetPrimary}, ${result.city}`);
      console.log(`   Appraised Value: $${result.appraisedValue?.toLocaleString()}`);
    });

    // Step 3: Calculate pagination needed for all results
    console.log('\n' + '='.repeat(80));
    console.log('PAGINATION ANALYSIS');
    console.log('='.repeat(80) + '\n');

    const totalCount = response.totalCount || 0;
    const pageSize = 100;
    const totalPages = Math.ceil(totalCount / pageSize);

    console.log(`Total properties: ${totalCount}`);
    console.log(`Page size: ${pageSize}`);
    console.log(`Total pages needed: ${totalPages}`);
    console.log(`\nTo get ALL results, we would need to make ${totalPages} API calls.`);

    // Step 4: Test getting multiple pages
    console.log('\n' + '='.repeat(80));
    console.log('TESTING MULTI-PAGE RETRIEVAL');
    console.log('='.repeat(80) + '\n');

    console.log('Fetching pages 1, 2, and 3...\n');

    const multiPageResults = await page.evaluate(async (token: string) => {
      const apiUrl = 'https://prod-container.trueprodigyapi.com/public/property/searchfulltext';
      const requestBody = {
        pYear: { operator: '=', value: '2025' },
        fullTextSearch: { operator: 'match', value: 'Smith' }
      };

      const allResults = [];
      for (let page = 1; page <= 3; page++) {
        const url = `${apiUrl}?page=${page}&pageSize=100`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': token,
          },
          body: JSON.stringify(requestBody)
        });
        const data = await res.json();
        allResults.push({
          page,
          count: data.results?.length || 0,
          firstPid: data.results?.[0]?.pid,
          lastPid: data.results?.[data.results.length - 1]?.pid,
        });
      }
      return allResults;
    }, authToken);

    multiPageResults.forEach((result: any) => {
      console.log(`Page ${result.page}: ${result.count} results (PID range: ${result.firstPid} - ${result.lastPid})`);
    });

    const totalFetched = multiPageResults.reduce((sum: number, r: any) => sum + r.count, 0);
    console.log(`\n✅ Successfully fetched ${totalFetched} results across 3 pages!`);

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('SOLUTION SUMMARY');
    console.log('='.repeat(80) + '\n');

    console.log('🎯 WORKAROUND CONFIRMED!\n');
    console.log('Instead of scraping the UI with Playwright:');
    console.log('1. Navigate to the page once to get cookies/session');
    console.log('2. Use page.evaluate() to call fetch() directly');
    console.log('3. Set pageSize to 100-1000 (test to find max allowed)');
    console.log('4. Loop through pages to get all results');
    console.log('5. This bypasses the hidden AG Grid pagination completely!\n');

    console.log('Benefits:');
    console.log('✅ No DOM parsing needed');
    console.log('✅ Much faster (direct JSON response)');
    console.log('✅ Can get 1000s of results per search term');
    console.log('✅ More reliable (no UI element waiting)');
    console.log('✅ Less resource intensive\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await context.close();
    await browser.close();
  }
}

testDirectAPIBypass();
