"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
async function diagnosePagination() {
    console.log('🔍 Diagnosing pagination elements...\n');
    const browser = await playwright_1.chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
        console.log('Loading TCAD search page...');
        await page.goto('https://travis.prodigycad.com/property-search', {
            waitUntil: 'networkidle',
        });
        // Wait for React
        await page.waitForFunction(() => {
            const root = document.getElementById('root');
            return root && root.children.length > 0;
        }, { timeout: 15000 });
        console.log('Page loaded, performing search...');
        // Search for a common name
        await page.waitForSelector('#searchInput', { timeout: 10000 });
        await page.type('#searchInput', 'Smith', { delay: 100 });
        await page.press('#searchInput', 'Enter');
        await page.waitForTimeout(3000);
        // Wait for results
        await page.waitForFunction(() => {
            const hasGridCells = document.querySelector('[role="gridcell"]') !== null;
            const hasNoResults = document.querySelector('.ag-overlay-no-rows-center') !== null;
            return hasGridCells || hasNoResults;
        }, { timeout: 15000 });
        console.log('\n=== Checking Status Bar Elements ===');
        // Check various status bar selectors
        const statusBarInfo = await page.evaluate(() => {
            const selectors = [
                '.ag-status-bar-center',
                '.ag-status-name-value',
                '[ref="eName"]',
                '.ag-status-bar',
                '.ag-paging-row-summary-panel',
            ];
            const results = {};
            selectors.forEach(selector => {
                const el = document.querySelector(selector);
                results[selector] = {
                    exists: !!el,
                    text: el?.textContent?.trim() || null,
                    innerHTML: el?.innerHTML || null,
                };
            });
            // Also get all elements with 'ag-status' or 'paging' in class name
            const allStatusElements = Array.from(document.querySelectorAll('[class*="ag-status"], [class*="paging"]'));
            results['allStatusElements'] = allStatusElements.map(el => ({
                tag: el.tagName,
                class: el.className,
                text: el.textContent?.trim(),
            }));
            return results;
        });
        console.log(JSON.stringify(statusBarInfo, null, 2));
        console.log('\n=== Checking Pagination Elements ===');
        const paginationInfo = await page.evaluate(() => {
            return {
                pageSize: {
                    selector: document.querySelector('.ag-paging-page-size'),
                    value: document.querySelector('.ag-paging-page-size')?.value,
                    options: Array.from(document.querySelectorAll('.ag-paging-page-size option')).map((opt) => ({
                        value: opt.value,
                        text: opt.textContent?.trim(),
                    })),
                },
                nextButton: {
                    exists: !!document.querySelector('.ag-paging-button[ref="btNext"]'),
                    disabled: document.querySelector('.ag-paging-button[ref="btNext"]')?.classList.contains('ag-disabled'),
                },
                prevButton: {
                    exists: !!document.querySelector('.ag-paging-button[ref="btPrevious"]'),
                    disabled: document.querySelector('.ag-paging-button[ref="btPrevious"]')?.classList.contains('ag-disabled'),
                },
            };
        });
        console.log(JSON.stringify(paginationInfo, null, 2));
        console.log('\n=== Taking Screenshot ===');
        await page.screenshot({
            path: '/home/aledlie/tcad-scraper/server/pagination-diagnostic.png',
            fullPage: true
        });
        console.log('Screenshot saved to: pagination-diagnostic.png');
        console.log('\n✅ Diagnostic complete!');
        console.log('Keep browser open for 10 seconds to inspect...');
        await page.waitForTimeout(10000);
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
    finally {
        await context.close();
        await browser.close();
    }
}
diagnosePagination();
//# sourceMappingURL=diagnose-pagination.js.map