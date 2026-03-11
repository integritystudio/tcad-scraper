import { expect, test } from "@playwright/test";
import { SearchBoxPage } from "./pages/SearchBoxPage";

/**
 * Tests API error handling via Playwright route interception.
 * Verifies the UI gracefully handles server errors, timeouts, and network failures.
 */
test.describe("API error handling", () => {
	test("displays error message on 500 server error", async ({ page }) => {
		const search = new SearchBoxPage(page);
		await search.goto();

		// Intercept search API and return 500
		await page.route("**/api/properties/search**", (route) =>
			route.fulfill({
				status: 500,
				contentType: "application/json",
				body: JSON.stringify({ error: "Internal Server Error" }),
			}),
		);

		await search.search("Oak Street");

		// Error state should appear
		await expect(page.getByText(/error/i).first()).toBeVisible({
			timeout: 10_000,
		});
	});

	test("displays error message on network failure", async ({ page }) => {
		const search = new SearchBoxPage(page);
		await search.goto();

		// Abort the network request to simulate failure
		await page.route("**/api/properties/search**", (route) => route.abort());

		await search.search("Oak Street");

		await expect(page.getByText(/error/i).first()).toBeVisible({
			timeout: 10_000,
		});
	});

	test("displays error message on 429 rate limit", async ({ page }) => {
		const search = new SearchBoxPage(page);
		await search.goto();

		await page.route("**/api/properties/search**", (route) =>
			route.fulfill({
				status: 429,
				contentType: "application/json",
				body: JSON.stringify({ error: "Rate limit exceeded" }),
			}),
		);

		await search.search("Oak Street");

		await expect(page.getByText(/error/i).first()).toBeVisible({
			timeout: 10_000,
		});
	});

	test("search button re-enables after error so user can retry", async ({
		page,
	}) => {
		const search = new SearchBoxPage(page);
		await search.goto();

		// First request fails
		await page.route("**/api/properties/search**", (route) =>
			route.fulfill({
				status: 500,
				contentType: "application/json",
				body: JSON.stringify({ error: "Server Error" }),
			}),
		);

		await search.search("Oak Street");
		await expect(page.getByText(/error/i).first()).toBeVisible({
			timeout: 10_000,
		});

		// Button should be re-enabled for retry
		await expect(search.searchButton).toBeEnabled();
	});

	test("loading state clears after error response", async ({ page }) => {
		const search = new SearchBoxPage(page);
		await search.goto();

		await page.route("**/api/properties/search**", (route) =>
			route.fulfill({
				status: 503,
				contentType: "application/json",
				body: JSON.stringify({ error: "Service Unavailable" }),
			}),
		);

		await search.search("Oak Street");
		await expect(page.getByText(/error/i).first()).toBeVisible({
			timeout: 10_000,
		});

		// aria-busy should be false (not loading anymore)
		await expect(search.searchbox).not.toHaveAttribute("aria-busy", "true");
	});
});
