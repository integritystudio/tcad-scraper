"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
async function testBothURLs() {
    console.log('🔍 Testing STAGING vs PRODUCTION URLs...\n');
    const browser = await playwright_1.chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const searchTerm = 'dede';
    for (const env of ['staging', 'production']) {
        const url = env === 'staging'
            ? 'https://stage.travis.prodigycad.com/property-search'
            : 'https://travis.prodigycad.com/property-search';
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Testing ${env.toUpperCase()}: ${url}`);
        console.log('='.repeat(60));
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            viewport: { width: 1920, height: 1080 },
        });
        const page = await context.newPage();
        try {
            await page.goto(url, {
                waitUntil: 'networkidle',
                timeout: 30000,
            });
            // Wait for React to render
            await page.waitForFunction(() => {
                const root = document.getElementById('root');
                return root && root.children.length > 0;
            }, { timeout: 15000 });
            // Perform search
            await page.waitForSelector('#searchInput', { timeout: 10000 });
            await page.type('#searchInput', searchTerm, { delay: 100 });
            await page.waitForTimeout(500);
            await page.press('#searchInput', 'Enter');
            // Wait for potential results
            await page.waitForTimeout(5000);
            // Analyze results
            const analysis = await page.evaluate(() => {
                const messages = [];
                const noRowsElement = document.querySelector('.ag-overlay-no-rows-center');
                if (noRowsElement) {
                    messages.push(noRowsElement.textContent?.trim() || '');
                }
                const gridcells = document.querySelectorAll('[role="gridcell"]');
                const rows = document.querySelectorAll('[aria-label="Press SPACE to select this row."][role="row"]');
                return {
                    hasNoRowsMessage: messages.length > 0,
                    messages,
                    gridcellCount: gridcells.length,
                    rowCount: rows.length,
                };
            });
            console.log(`\n📊 Results for "${searchTerm}":`);
            console.log(`  Gridcells: ${analysis.gridcellCount}`);
            console.log(`  Rows: ${analysis.rowCount}`);
            if (analysis.hasNoRowsMessage) {
                console.log(`  ❌ Message: ${analysis.messages.join(', ')}`);
            }
            else if (analysis.rowCount > 0) {
                console.log(`  ✅ Found ${analysis.rowCount} results!`);
            }
            // Take screenshot
            const screenshotPath = `/home/aledlie/tcad-scraper/server/${env}-results.png`;
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`  📸 Screenshot: ${screenshotPath}`);
        }
        catch (error) {
            console.error(`  ❌ Error: ${error.message}`);
        }
        finally {
            await context.close();
        }
    }
    await browser.close();
    console.log('\n✅ Test complete!');
}
testBothURLs();
//# sourceMappingURL=test-urls.js.map