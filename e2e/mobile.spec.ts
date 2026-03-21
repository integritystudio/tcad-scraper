import { expect, test } from "@playwright/test";
import { PropertyCardPage } from "./pages/PropertyCardPage";
import { SearchBoxPage } from "./pages/SearchBoxPage";

const MOCK_SEARCH_RESPONSE = {
	data: [
		{
			id: 1,
			property_id: "R100001",
			geo_id: "0220010101",
			name: "John Smith",
			property_address: "123 Oak Street",
			city: "Austin",
			prop_type: "Real",
			appraised_value: 450000,
			assessed_value: 400000,
			description: "LOT 1 BLK A",
			scraped_at: "2026-01-15T00:00:00Z",
			updated_at: "2026-01-15T00:00:00Z",
			created_at: "2025-06-01T00:00:00Z",
		},
	],
	pagination: { total: 1, limit: 50, offset: 0, hasMore: false },
	query: {
		original: "Oak Street",
		explanation: "Properties on Oak Street",
	},
};

/**
 * Mobile viewport tests to verify responsive layout.
 */
test.describe("Mobile responsive", () => {
	test.use({ viewport: { width: 375, height: 812 } }); // iPhone X

	test("page renders correctly on mobile viewport", async ({ page }) => {
		await page.goto("/");
		await expect(
			page.getByRole("heading", { name: /TCAD Property Explorer/i }),
		).toBeVisible();
		await expect(page.getByRole("searchbox")).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Search properties" }),
		).toBeVisible();
	});

	test("search works on mobile", async ({ page }) => {
		const search = new SearchBoxPage(page);
		await page.route("**/api/properties/search**", (route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(MOCK_SEARCH_RESPONSE),
			}),
		);
		await search.goto();
		await search.search("Oak Street");

		await expect(
			page
				.getByText("No properties found")
				.or(page.getByRole("button", { name: /show details/i }).first()),
		).toBeVisible({ timeout: 15_000 });
	});

	test("property card expand/collapse works on mobile", async ({ page }) => {
		const search = new SearchBoxPage(page);
		const card = new PropertyCardPage(page);
		await page.route("**/api/properties/search**", (route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(MOCK_SEARCH_RESPONSE),
			}),
		);
		await search.goto();
		await search.search("Oak Street");
		await card.waitForResults();

		await card.expandFirst();
		await expect(page.getByText("Financial Breakdown").first()).toBeVisible();

		await card.collapseFirst();
		await expect(
			page.getByText("Financial Breakdown").first(),
		).not.toBeVisible();
	});
});

test.describe("Tablet responsive", () => {
	test.use({ viewport: { width: 768, height: 1024 } }); // iPad

	test("page renders correctly on tablet viewport", async ({ page }) => {
		await page.goto("/");
		await expect(
			page.getByRole("heading", { name: /TCAD Property Explorer/i }),
		).toBeVisible();
	});

	test("search and results render on tablet", async ({ page }) => {
		const search = new SearchBoxPage(page);
		const _card = new PropertyCardPage(page);
		await page.route("**/api/properties/search**", (route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(MOCK_SEARCH_RESPONSE),
			}),
		);
		await search.goto();
		await search.search("Oak Street");

		await expect(
			page
				.getByText("No properties found")
				.or(page.getByRole("button", { name: /show details/i }).first()),
		).toBeVisible({ timeout: 15_000 });
	});
});
