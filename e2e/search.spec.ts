import { expect, test } from "@playwright/test";
import { SearchBoxPage } from "./pages/SearchBoxPage";

test.describe("Search happy path", () => {
	test("search input and button are visible on load", async ({ page }) => {
		const search = new SearchBoxPage(page);
		await search.goto();
		await expect(search.searchbox).toBeVisible();
		await expect(search.searchButton).toBeVisible();
	});

	test("typing a query enables the search button", async ({ page }) => {
		const search = new SearchBoxPage(page);
		await search.goto();

		// Button disabled with empty input
		await expect(search.searchButton).toBeDisabled();

		// Type a query
		await search.fillQuery("Oak Street");
		await expect(search.searchButton).toBeEnabled();
	});

	test("submitting a search shows results or no-results state", async ({
		page,
	}) => {
		const search = new SearchBoxPage(page);
		await search.goto();
		await search.search("Oak Street");

		// Wait for either results grid or no-results message
		await expect(
			page
				.getByText("No properties found")
				.or(page.getByRole("button", { name: /show details/i }).first()),
		).toBeVisible({ timeout: 15_000 });
	});

	test("search input shows loading state during request", async ({ page }) => {
		const search = new SearchBoxPage(page);

		// Complete the initial load immediately to prevent race with search loading state
		await page.route("**/api/properties?**", (route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					data: [],
					pagination: { total: 0, limit: 50, offset: 0, hasMore: false },
				}),
			}),
		);

		await search.goto();

		// Hold the search API response to observe loading state
		let fulfillRoute: (() => void) | undefined;
		await page.route("**/api/properties/search**", async (route) => {
			await new Promise<void>((resolve) => {
				fulfillRoute = resolve;
			});
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					data: [],
					pagination: { total: 0, limit: 50, offset: 0, hasMore: false },
					query: {
						original: "Austin properties",
						explanation: "Search results",
					},
				}),
			});
		});

		await search.search("Austin properties");

		// Request is in-flight — assert loading state
		await expect(search.searchbox).toHaveAttribute("aria-busy", "true");

		// Release the API response
		fulfillRoute?.();
	});

	test("page heading is visible", async ({ page }) => {
		const search = new SearchBoxPage(page);
		await search.goto();
		await expect(
			page.getByRole("heading", { name: /TCAD Property Explorer/i }),
		).toBeVisible();
	});
});
