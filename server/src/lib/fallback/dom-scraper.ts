/**
 * DOM-BASED SCRAPER - FALLBACK MECHANISM ONLY
 *
 * ⚠️ WARNING: This is a DEPRECATED fallback method
 *
 * This scraper is limited to 20 results per search due to AG Grid's hidden pagination.
 * It should ONLY be used when the primary API-based scraping method fails.
 *
 * Primary method: scrapePropertiesViaAPI() in tcad-scraper.ts
 * Fallback method: scrapeDOMFallback() in this file
 *
 * Limitations:
 * - Maximum 20 results per search (AG Grid pagination restriction)
 * - Slower performance (DOM manipulation + individual page scraping)
 * - Higher resource usage
 * - More fragile (breaks if UI changes)
 *
 * Use cases:
 * - API authentication failures
 * - API rate limiting
 * - API endpoint changes
 * - Emergency data retrieval
 */

import type { Browser, Page } from "playwright";
import type { PropertyData, ScraperConfig } from "../../types";
import { suppressBrowserConsoleWarnings } from "../../utils/browser-console-suppression";
import { getErrorMessage } from "../../utils/error-helpers";
import { humanDelay } from "../../utils/timing";
import logger from "../logger";

/**
 * Scrape property details from individual property page
 */
async function scrapePropertyDetail(
	page: Page,
	propertyId: string,
): Promise<PropertyData | null> {
	try {
		const detailUrl = `https://travis.prodigycad.com/property-detail?pid=${propertyId}`;
		await page.goto(detailUrl, {
			waitUntil: "networkidle",
			timeout: 15000,
		});

		await humanDelay(1000, 2000);

		const propertyData = await page.evaluate(() => {
			const getValueByLabel = (labelText: string): string | null => {
				const labels = document.querySelectorAll(
					'label, dt, th, .label, [class*="label"]',
				);

				let labelIdx = 0;
				while (labelIdx < labels.length) {
					const label = labels[labelIdx];
					const text = label.textContent?.trim().toLowerCase() || "";

					if (text.includes(labelText.toLowerCase())) {
						let valueElem = label.nextElementSibling;
						if (valueElem?.textContent) {
							return valueElem.textContent.trim();
						}

						if (label.parentElement) {
							valueElem = label.parentElement.nextElementSibling;
							if (valueElem?.textContent) {
								return valueElem.textContent.trim();
							}
						}

						if (label.tagName === "TH") {
							const row = label.closest("tr");
							if (row) {
								const cells = row.querySelectorAll("td");
								if (cells.length > 0) {
									return cells[0].textContent?.trim() || null;
								}
							}
						}
					}

					labelIdx++;
				}

				return null;
			};

			const name = getValueByLabel("owner") || getValueByLabel("name") || "";
			const propType =
				getValueByLabel("property type") || getValueByLabel("type") || "";
			const city =
				getValueByLabel("city") || getValueByLabel("situs city") || null;
			const propertyAddress =
				getValueByLabel("address") ||
				getValueByLabel("situs address") ||
				getValueByLabel("street") ||
				"";

			const appraisedValueText =
				getValueByLabel("appraised value") ||
				getValueByLabel("market value") ||
				getValueByLabel("total value") ||
				"0";
			const appraisedValue =
				parseFloat(appraisedValueText.replace(/[$,]/g, "")) || 0;

			const assessedValueText =
				getValueByLabel("assessed value") ||
				getValueByLabel("taxable value") ||
				"0";
			const assessedValue =
				parseFloat(assessedValueText.replace(/[$,]/g, "")) || 0;

			const geoId =
				getValueByLabel("geo id") || getValueByLabel("geographic id") || null;
			const description =
				getValueByLabel("legal description") ||
				getValueByLabel("description") ||
				null;

			return {
				name,
				propType,
				city,
				propertyAddress,
				appraisedValue,
				assessedValue,
				geoId,
				description,
			};
		});

		return {
			propertyId,
			...propertyData,
		};
	} catch (error) {
		logger.error(
			{ propertyId, err: getErrorMessage(error) },
			"Error scraping detail page",
		);
		return null;
	}
}

/**
 * FALLBACK: DOM-based property scraping
 *
 * ⚠️ This method is LIMITED to 20 results due to AG Grid pagination restrictions
 * ⚠️ Use only when API-based scraping fails
 *
 * @param browser - Playwright browser instance
 * @param config - Scraper configuration
 * @param searchTerm - Search term
 * @param maxRetries - Maximum retry attempts
 * @returns Array of PropertyData (max 20 results)
 */
export async function scrapeDOMFallback(
	browser: Browser,
	config: ScraperConfig,
	searchTerm: string,
	maxRetries: number = 3,
): Promise<PropertyData[]> {
	logger.warn({ method: "dom", limit: 20 }, "Fallback scraping mode");

	let lastError: Error | null = null;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			logger.info({ attempt, searchTerm }, "DOM fallback attempt");

			const context = await browser.newContext({
				userAgent:
					config.userAgents[
						Math.floor(Math.random() * config.userAgents.length)
					],
				viewport:
					config.viewports[Math.floor(Math.random() * config.viewports.length)],
				locale: "en-US",
				timezoneId: "America/Chicago",
			});

			const page = await context.newPage();

			// Suppress browser console warnings from TCAD website
			suppressBrowserConsoleWarnings(page, logger);

			await page.setExtraHTTPHeaders({
				"Accept-Language": "en-US,en;q=0.9",
				"Accept-Encoding": "gzip, deflate, br",
				"Cache-Control": "no-cache",
				Pragma: "no-cache",
			});

			try {
				await page.goto("https://travis.prodigycad.com/property-search", {
					waitUntil: "networkidle",
					timeout: config.timeout,
				});

				logger.info("Page loaded, waiting for React app...");

				await page.waitForFunction(
					() => {
						const root = document.getElementById("root");
						return root && root.children.length > 0;
					},
					{ timeout: 15000 },
				);

				logger.info("React app loaded, performing search...");
				await humanDelay(1000, 1500);

				await page.waitForSelector("#searchInput", { timeout: 10000 });
				await humanDelay(500, 1000);
				await page.type("#searchInput", searchTerm, {
					delay: 50 + Math.random() * 100,
				});
				await humanDelay(300, 700);
				await page.press("#searchInput", "Enter");
				await humanDelay(2000, 3000);

				await page.waitForFunction(
					() => {
						const hasGridCells =
							document.querySelector('[role="gridcell"]') !== null;
						const hasNoResults =
							document.querySelector(".ag-overlay-no-rows-center") !== null ||
							document.body.textContent?.includes("No Rows To Show");
						return hasGridCells || hasNoResults;
					},
					{ timeout: 15000 },
				);

				await humanDelay(1000, 1500);

				const hasNoResults = await page.evaluate(() => {
					const noResultsOverlay =
						document.querySelector(".ag-overlay-no-rows-center") !== null;
					const hasGridCells =
						document.querySelector('[role="gridcell"]') !== null;
					return noResultsOverlay && !hasGridCells;
				});

				if (hasNoResults) {
					logger.info({ searchTerm }, "No results found");
					await context.close();
					return [];
				}

				logger.info("Results loaded, extracting property IDs...");

				const propertyIds = await page.evaluate(() => {
					const rows = document.querySelectorAll('[role="row"][row-index]');
					const ids = [];

					let rowIndex = 0;
					while (rowIndex < rows.length) {
						const row = rows[rowIndex];
						const pidElem = row.querySelector('[col-id="pid"]');
						const propertyId = pidElem ? pidElem.textContent.trim() : "";

						if (propertyId) {
							ids.push(propertyId);
						}

						rowIndex++;
					}

					return ids;
				});

				logger.warn(
					{ count: propertyIds.length, max: 20 },
					"DOM scraping property IDs found (pagination-limited)",
				);

				const properties = [];
				let successCount = 0;
				let failCount = 0;

				for (let i = 0; i < propertyIds.length; i++) {
					const propertyId = propertyIds[i];

					try {
						logger.info(
							{ propertyId, progress: `${i + 1}/${propertyIds.length}` },
							"Scraping property",
						);

						const propertyData = await scrapePropertyDetail(page, propertyId);

						if (propertyData) {
							properties.push(propertyData);
							successCount++;
						} else {
							failCount++;
						}

						await humanDelay(500, 1000);
					} catch (error) {
						logger.error(
							{ propertyId, err: getErrorMessage(error) },
							"Failed to scrape property",
						);
						failCount++;
					}
				}

				logger.info({ successCount, failCount }, "DOM fallback complete");
				logger.warn(
					{ count: properties.length, max: 20 },
					"Results limited by AG Grid pagination",
				);

				await context.close();
				return properties;
			} finally {
				await context.close();
			}
		} catch (error) {
			lastError = error as Error;
			logger.error(
				{ attempt, err: getErrorMessage(error) },
				"DOM fallback attempt failed",
			);

			if (attempt < maxRetries) {
				const delay = config.retryDelay * 2 ** (attempt - 1);
				logger.info({ delayMs: delay }, "Retrying DOM fallback");
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}
	}

	throw lastError || new Error("All DOM fallback scraping attempts failed");
}
