"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const playwright_1 = require("playwright");
const logger_1 = __importDefault(require("../lib/logger"));
async function checkColumnIds() {
    logger_1.default.info('🔍 Checking actual column IDs...\n');
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
        await page.waitForFunction(() => {
            const root = document.getElementById('root');
            return root && root.children.length > 0;
        }, { timeout: 15000 });
        await page.waitForSelector('#searchInput', { timeout: 10000 });
        await page.type('#searchInput', 'dede', { delay: 100 });
        await page.waitForTimeout(500);
        await page.press('#searchInput', 'Enter');
        await page.waitForTimeout(7000);
        const columnInfo = await page.evaluate(() => {
            const firstRow = document.querySelector('.ag-row');
            if (!firstRow)
                return { error: 'No rows found' };
            const cells = firstRow.querySelectorAll('[role="gridcell"]');
            const cellsInfo = Array.from(cells).map(cell => ({
                colId: cell.getAttribute('col-id'),
                text: cell.textContent?.trim(),
                ariaColIndex: cell.getAttribute('aria-colindex'),
            }));
            return { cellsInfo };
        });
        logger_1.default.info('📊 All Column IDs from first row:\n');
        if ('error' in columnInfo) {
            logger_1.default.error(columnInfo.error);
        }
        else {
            columnInfo.cellsInfo.forEach((cell, i) => {
                logger_1.default.info(`Column ${i + 1}:`);
                logger_1.default.info(`  col-id: ${cell.colId}`);
                logger_1.default.info(`  text: ${cell.text || '(empty)'}`);
                logger_1.default.info(`  aria-colindex: ${cell.ariaColIndex}\n`);
            });
        }
    }
    catch (error) {
        logger_1.default.error(`❌ Error: ${error.message}`);
    }
    finally {
        await context.close();
        await browser.close();
    }
}
checkColumnIds();
//# sourceMappingURL=check-column-ids.js.map