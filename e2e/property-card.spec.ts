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

test.describe("Property card expand/collapse", () => {
	test.beforeEach(async ({ page }) => {
		await page.route("**/api/properties/search**", (route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(MOCK_SEARCH_RESPONSE),
			}),
		);
	});

	async function searchForProperties(
		search: SearchBoxPage,
		card: PropertyCardPage,
	) {
		await search.goto();
		await search.search("Oak Street");
		await card.waitForResults();
	}

	test("expand button shows details and updates aria-expanded", async ({
		page,
	}) => {
		const search = new SearchBoxPage(page);
		const card = new PropertyCardPage(page);
		await searchForProperties(search, card);

		// Should start collapsed
		await expect(card.firstExpandButton()).toHaveAttribute(
			"aria-expanded",
			"false",
		);

		await card.expandFirst();

		// After click, should be expanded
		await expect(card.firstHideButton()).toHaveAttribute(
			"aria-expanded",
			"true",
		);
	});

	test("collapse button hides details", async ({ page }) => {
		const search = new SearchBoxPage(page);
		const card = new PropertyCardPage(page);
		await searchForProperties(search, card);

		await card.expandFirst();
		await card.collapseFirst();

		// Should be back to collapsed
		await expect(card.firstExpandButton()).toHaveAttribute(
			"aria-expanded",
			"false",
		);
	});

	test("expanded card shows financial breakdown section", async ({ page }) => {
		const search = new SearchBoxPage(page);
		const card = new PropertyCardPage(page);
		await searchForProperties(search, card);

		await card.expandFirst();

		await expect(page.getByText("Financial Breakdown").first()).toBeVisible();
	});
});
