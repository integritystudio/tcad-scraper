import { chromium } from "playwright";
import logger from "../lib/logger";
import { getErrorMessage } from "../utils/error-helpers";

async function checkColumnIds() {
	logger.info("🔍 Checking actual column IDs...\n");

	const browser = await chromium.launch({
		headless: true,
		args: ["--no-sandbox", "--disable-setuid-sandbox"],
	});

	const context = await browser.newContext({
		userAgent:
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
		viewport: { width: 1920, height: 1080 },
	});

	const page = await context.newPage();

	try {
		await page.goto("https://travis.prodigycad.com/property-search", {
			waitUntil: "networkidle",
			timeout: 30000,
		});

		await page.waitForFunction(
			() => {
				const root = document.getElementById("root");
				return root && root.children.length > 0;
			},
			{ timeout: 15000 },
		);

		await page.waitForSelector("#searchInput", { timeout: 10000 });
		await page.type("#searchInput", "dede", { delay: 100 });
		await page.waitForTimeout(500);
		await page.press("#searchInput", "Enter");
		await page.waitForTimeout(7000);

		const columnInfo = await page.evaluate(() => {
			const firstRow = document.querySelector(".ag-row");
			if (!firstRow) return { error: "No rows found" };

			const cells = firstRow.querySelectorAll('[role="gridcell"]');
			const cellsInfo = Array.from(cells).map((cell) => ({
				colId: cell.getAttribute("col-id"),
				text: cell.textContent?.trim(),
				ariaColIndex: cell.getAttribute("aria-colindex"),
			}));

			return { cellsInfo };
		});

		logger.info("📊 All Column IDs from first row:\n");
		if ("error" in columnInfo) {
			logger.error(columnInfo.error);
		} else {
			columnInfo.cellsInfo.forEach((cell, i) => {
				logger.info(`Column ${i + 1}:`);
				logger.info(`  col-id: ${cell.colId}`);
				logger.info(`  text: ${cell.text || "(empty)"}`);
				logger.info(`  aria-colindex: ${cell.ariaColIndex}\n`);
			});
		}
	} catch (error: unknown) {
		logger.error(`❌ Error: ${getErrorMessage(error)}`);
	} finally {
		await context.close();
		await browser.close();
	}
}

checkColumnIds();
