"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
/**
 * Test script to intercept network requests and identify the backend API
 * that AG Grid uses to fetch property data. If we can identify the API endpoint,
 * we can bypass the 20-result pagination limit entirely.
 */
async function testNetworkInterception() {
    console.log('🔍 Testing network interception to find backend API...\n');
    const browser = await playwright_1.chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    // Array to store all network requests
    const apiRequests = [];
    // Intercept all network requests
    page.on('request', (request) => {
        const url = request.url();
        const method = request.method();
        // Look for API calls (not static assets)
        if (!url.includes('.js') &&
            !url.includes('.css') &&
            !url.includes('.png') &&
            !url.includes('.jpg') &&
            !url.includes('.svg') &&
            !url.includes('.woff') &&
            !url.includes('static/')) {
            console.log(`📤 REQUEST: ${method} ${url}`);
            const postData = request.postData();
            if (postData) {
                console.log(`   POST Data: ${postData.substring(0, 200)}...`);
            }
            apiRequests.push({
                url,
                method,
                postData: postData || undefined,
            });
        }
    });
    // Intercept all network responses
    page.on('response', async (response) => {
        const url = response.url();
        const status = response.status();
        // Look for API responses
        if (!url.includes('.js') &&
            !url.includes('.css') &&
            !url.includes('.png') &&
            !url.includes('.jpg') &&
            !url.includes('.svg') &&
            !url.includes('.woff') &&
            !url.includes('static/')) {
            console.log(`📥 RESPONSE: ${status} ${url}`);
            try {
                // Try to get JSON response
                const contentType = response.headers()['content-type'];
                if (contentType && contentType.includes('application/json')) {
                    const json = await response.json();
                    console.log(`   Response preview: ${JSON.stringify(json).substring(0, 200)}...`);
                    // Store response data
                    const request = apiRequests.find(r => r.url === url);
                    if (request) {
                        request.response = json;
                    }
                }
            }
            catch (error) {
                // Response might not be JSON
            }
        }
    });
    try {
        console.log('Loading TCAD search page...');
        await page.goto('https://travis.prodigycad.com/property-search', {
            waitUntil: 'networkidle',
            timeout: 30000,
        });
        // Wait for React
        await page.waitForFunction(() => {
            const root = document.getElementById('root');
            return root && root.children.length > 0;
        }, { timeout: 15000 });
        console.log('\nPage loaded, performing search...\n');
        // Search for a common term that will definitely return results
        await page.waitForSelector('#searchInput', { timeout: 10000 });
        await page.type('#searchInput', 'Smith', { delay: 100 });
        await page.press('#searchInput', 'Enter');
        // Wait for results to load
        console.log('Waiting for search results...\n');
        await page.waitForTimeout(5000);
        // Wait for grid to populate
        await page.waitForFunction(() => {
            const hasGridCells = document.querySelector('[role="gridcell"]') !== null;
            const hasNoResults = document.querySelector('.ag-overlay-no-rows-center') !== null;
            return hasGridCells || hasNoResults;
        }, { timeout: 15000 });
        console.log('\n' + '='.repeat(80));
        console.log('NETWORK ANALYSIS COMPLETE');
        console.log('='.repeat(80) + '\n');
        console.log(`Total API requests captured: ${apiRequests.length}\n`);
        // Filter for potential data API endpoints
        const dataEndpoints = apiRequests.filter(req => req.url.includes('api') ||
            req.url.includes('search') ||
            req.url.includes('property') ||
            req.url.includes('query') ||
            req.method === 'POST');
        console.log('🎯 POTENTIAL DATA ENDPOINTS:\n');
        dataEndpoints.forEach((req, i) => {
            console.log(`${i + 1}. ${req.method} ${req.url}`);
            if (req.postData) {
                console.log(`   POST Data: ${req.postData}`);
            }
            if (req.response) {
                const responseStr = JSON.stringify(req.response);
                console.log(`   Response: ${responseStr.substring(0, 300)}...`);
                // Check if response contains property data
                if (responseStr.includes('propertyId') ||
                    responseStr.includes('address') ||
                    responseStr.includes('owner') ||
                    responseStr.includes('assessed') ||
                    responseStr.includes('appraised')) {
                    console.log('   ✅ This looks like the property data endpoint!');
                }
            }
            console.log('');
        });
        // Check if we can extract the full dataset from the page's memory
        console.log('\n' + '='.repeat(80));
        console.log('CHECKING FOR DATA IN REACT STATE');
        console.log('='.repeat(80) + '\n');
        const reactStateData = await page.evaluate(() => {
            // Try to find React Fiber nodes
            const root = document.getElementById('root');
            if (!root)
                return null;
            // Try to access React internals
            const reactRoot = root._reactRootContainer || root._reactRootContainer;
            // Try to find data in various places
            const results = {
                windowKeys: Object.keys(window).filter(k => k.toLowerCase().includes('data') ||
                    k.toLowerCase().includes('property') ||
                    k.toLowerCase().includes('grid')),
                gridData: null,
            };
            // Look for AG Grid data
            try {
                const gridDivs = document.querySelectorAll('[class*="ag-"]');
                for (const div of gridDivs) {
                    const gridApi = div.__agComponent?.api;
                    if (gridApi) {
                        // Try to get all row data
                        const allRows = [];
                        gridApi.forEachNode((node) => allRows.push(node.data));
                        results.gridData = {
                            totalRows: allRows.length,
                            sampleData: allRows.slice(0, 3),
                            displayedRowCount: gridApi.getDisplayedRowCount?.(),
                        };
                        break;
                    }
                }
            }
            catch (e) {
                // Ignore
            }
            return results;
        });
        console.log('Window object keys related to data:');
        console.log(reactStateData?.windowKeys || 'None found');
        console.log('\nAG Grid internal data:');
        console.log(JSON.stringify(reactStateData?.gridData, null, 2));
        // Save full report
        const report = {
            timestamp: new Date().toISOString(),
            totalRequests: apiRequests.length,
            dataEndpoints,
            reactState: reactStateData,
        };
        console.log('\n' + '='.repeat(80));
        console.log('SUMMARY');
        console.log('='.repeat(80));
        console.log('\nNext steps:');
        console.log('1. Review the potential data endpoints above');
        console.log('2. If an API endpoint is found, we can make direct HTTP requests');
        console.log('3. This would bypass the 20-result UI limitation completely');
        console.log('4. Look for pagination parameters in POST data (page, pageSize, offset, limit)');
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
    finally {
        await context.close();
        await browser.close();
    }
}
testNetworkInterception();
//# sourceMappingURL=test-network-interception.js.map