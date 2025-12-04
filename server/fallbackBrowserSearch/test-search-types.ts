import { chromium } from "playwright";

async function testSearchTypes() {
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext();
	const page = await context.newPage();

	const searchTerms = [
		{ term: "Austin", type: "City" },
		{ term: "Lamar", type: "Street" },
		{ term: "Congress", type: "Street" },
		{ term: "Round Rock", type: "City" },
	];

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

		console.log("\n=== Testing Different Search Terms ===\n");

		for (const { term, type } of searchTerms) {
			await page.fill("#searchInput", "");
			await page.waitForTimeout(1000);

			await page.type("#searchInput", term, { delay: 50 });
			await page.press("#searchInput", "Enter");
			await page.waitForTimeout(4000);

			const rowCount = await page.evaluate(() => {
				return document.querySelectorAll(".ag-row").length;
			});

			console.log(
				`${type.padEnd(10)} "${term.padEnd(15)}" -> ${rowCount > 0 ? `${rowCount} results` : "NO RESULTS"}`,
			);
		}
	} catch (error) {
		console.error("Error:", error);
	} finally {
		await browser.close();
	}
}

testSearchTypes();
