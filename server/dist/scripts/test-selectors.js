"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
async function testSelectors() {
    console.log('🔍 Testing different row selectors on production...\n');
    const browser = await playwright_1.chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();
    try {
        await page.goto('https://travis.prodigycad.com/property-search', {
            waitUntil: 'networkidle',
            timeout: 30000,
        });
        // Wait for React to render
        await page.waitForFunction(() => {
            const root = document.getElementById('root');
            return root && root.children.length > 0;
        }, { timeout: 15000 });
        // Perform search for "dede"
        await page.waitForSelector('#searchInput', { timeout: 10000 });
        await page.type('#searchInput', 'dede', { delay: 100 });
        await page.waitForTimeout(500);
        await page.press('#searchInput', 'Enter');
        // Wait for potential results
        await page.waitForTimeout(7000);
        // Test different row selectors
        const analysis = await page.evaluate(() => {
            const tests = {};
            // Test various selectors
            tests.spaceLabel = document.querySelectorAll('[aria-label="Press SPACE to select this row."][role="row"]').length;
            tests.roleRow = document.querySelectorAll('[role="row"]').length;
            tests.agRow = document.querySelectorAll('.ag-row').length;
            tests.agRowPosition = document.querySelectorAll('[row-index]').length;
            tests.gridcell = document.querySelectorAll('[role="gridcell"]').length;
            tests.noRowsOverlay = document.querySelectorAll('.ag-overlay-no-rows-wrapper').length;
            // Get sample row HTML for first ag-row
            const firstAgRow = document.querySelector('.ag-row');
            tests.firstAgRowHTML = firstAgRow ? firstAgRow.outerHTML.substring(0, 1000) : null;
            // Get sample cell data from first ag-row
            if (firstAgRow) {
                const cells = firstAgRow.querySelectorAll('[role="gridcell"]');
                tests.firstRowCells = Array.from(cells).slice(0, 5).map(cell => ({
                    colId: cell.getAttribute('col-id'),
                    text: cell.textContent?.trim(),
                }));
            }
            // Check if overlay is visible or hidden
            const overlay = document.querySelector('.ag-overlay-no-rows-wrapper');
            tests.overlayDisplay = overlay ? overlay.style.display : 'not found';
            return tests;
        });
        console.log('📊 Selector Test Results:');
        console.log('═══════════════════════════════════════════════════\n');
        console.log(`[aria-label="Press SPACE..."][role="row"]: ${analysis.spaceLabel}`);
        console.log(`[role="row"]: ${analysis.roleRow}`);
        console.log(`.ag-row: ${analysis.agRow}`);
        console.log(`[row-index]: ${analysis.agRowPosition}`);
        console.log(`[role="gridcell"]: ${analysis.gridcell}`);
        console.log(`No rows overlay elements: ${analysis.noRowsOverlay}`);
        console.log(`Overlay display style: ${analysis.overlayDisplay}\n`);
        if (analysis.firstRowCells && analysis.firstRowCells.length > 0) {
            console.log('✅ Found data rows! First row sample cells:');
            analysis.firstRowCells.forEach((cell, i) => {
                console.log(`  Cell ${i + 1}:`);
                console.log(`    col-id: ${cell.colId || 'none'}`);
                console.log(`    text: ${cell.text || 'empty'}`);
            });
            console.log('');
        }
        if (analysis.firstAgRowHTML) {
            console.log('📄 First .ag-row HTML (first 1000 chars):');
            console.log(analysis.firstAgRowHTML);
            console.log('');
        }
    }
    catch (error) {
        console.error(`❌ Error: ${error.message}`);
    }
    finally {
        await context.close();
        await browser.close();
    }
}
testSelectors();
//# sourceMappingURL=test-selectors.js.map