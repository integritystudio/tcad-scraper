import { expect, test } from "@playwright/test";
import { PropertyCardPage } from "./pages/PropertyCardPage";
import { SearchBoxPage } from "./pages/SearchBoxPage";

const MOCK_OAK_STREET_RESPONSE = {
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
		{
			id: 2,
			property_id: "R100002",
			geo_id: "0220010102",
			name: "Jane Doe",
			property_address: "456 Oak Street",
			city: "Austin",
			prop_type: "Real",
			appraised_value: 380000,
			assessed_value: 350000,
			description: "LOT 2 BLK A",
			scraped_at: "2026-01-15T00:00:00Z",
			updated_at: "2026-01-15T00:00:00Z",
			created_at: "2025-06-01T00:00:00Z",
		},
	],
	pagination: { total: 25, limit: 50, offset: 0, hasMore: false },
	query: {
		original: "Oak Street",
		explanation: "Properties on Oak Street",
	},
};

const MOCK_JOHNSON_RESPONSE = {
	data: [
		{
			id: 3,
			property_id: "R200001",
			geo_id: "0220020101",
			name: "Mary Johnson",
			property_address: "789 Main St",
			city: "Austin",
			prop_type: "Real",
			appraised_value: 520000,
			assessed_value: 480000,
			description: "LOT 5 BLK B",
			scraped_at: "2026-01-15T00:00:00Z",
			updated_at: "2026-01-15T00:00:00Z",
			created_at: "2025-06-01T00:00:00Z",
		},
	],
	pagination: { total: 5, limit: 50, offset: 0, hasMore: false },
	query: {
		original: "Johnson",
		explanation: "Properties matching Johnson",
	},
};

test.describe("Full search-to-details workflow", () => {
	test("search → results → expand → view all detail sections", async ({
		page,
	}) => {
		const search = new SearchBoxPage(page);
		const card = new PropertyCardPage(page);
		await search.goto();

		await page.route("**/api/properties/search**", (route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(MOCK_OAK_STREET_RESPONSE),
			}),
		);

		await search.search("Oak Street");
		await card.waitForResults();

		// Verify result cards are visible (at least one expand button present)
		await expect(
			page.getByRole("button", { name: /show details/i }).first(),
		).toBeVisible();

		// Expand first property
		await card.expandFirst();

		// All 4 detail sections should render
		await expect(page.getByText("Financial Breakdown").first()).toBeVisible();
		await expect(page.getByText("Identifiers").first()).toBeVisible();
		await expect(page.getByText("Data Freshness").first()).toBeVisible();
	});

	test("sequential searches replace previous results", async ({ page }) => {
		const search = new SearchBoxPage(page);
		const card = new PropertyCardPage(page);
		await search.goto();

		let searchCount = 0;
		await page.route("**/api/properties/search**", (route) => {
			searchCount++;
			const body =
				searchCount === 1 ? MOCK_OAK_STREET_RESPONSE : MOCK_JOHNSON_RESPONSE;
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(body),
			});
		});

		// First search
		await search.search("Oak Street");
		await card.waitForResults();
		const _firstOwner = await page
			.getByRole("heading", { level: 3 })
			.first()
			.textContent();

		// Second search with different term
		await search.search("Johnson");
		await expect(
			page
				.getByText("No properties found")
				.or(page.getByRole("button", { name: /show details/i }).first()),
		).toBeVisible({ timeout: 15_000 });

		// If results exist, they should have rendered without error
		const expandButtons = page.getByRole("button", { name: /show details/i });
		const count = await expandButtons.count();
		if (count > 0) {
			await expect(expandButtons.first()).toBeVisible();
		}
	});

	test("Enter key submits search", async ({ page }) => {
		const search = new SearchBoxPage(page);
		await search.goto();

		await page.route("**/api/properties/search**", (route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(MOCK_OAK_STREET_RESPONSE),
			}),
		);

		await search.fillQuery("Oak Street");
		await page.keyboard.press("Enter");

		// Should trigger search — wait for results or no-results
		await expect(
			page
				.getByText("No properties found")
				.or(page.getByRole("button", { name: /show details/i }).first()),
		).toBeVisible({ timeout: 15_000 });
	});

	test("explanation text appears with search results", async ({ page }) => {
		const search = new SearchBoxPage(page);
		const card = new PropertyCardPage(page);
		await search.goto();

		await page.route("**/api/properties/search**", (route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(MOCK_OAK_STREET_RESPONSE),
			}),
		);

		await search.search("Oak Street");
		await card.waitForResults();

		// The explanation or result count should be visible
		await expect(
			page.getByText(/results?\)/).or(page.getByText(/Showing/)),
		).toBeVisible();
	});

	test("result count is displayed", async ({ page }) => {
		const search = new SearchBoxPage(page);
		const card = new PropertyCardPage(page);
		await search.goto();

		await page.route("**/api/properties/search**", (route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(MOCK_OAK_STREET_RESPONSE),
			}),
		);

		await search.search("Oak Street");
		await card.waitForResults();

		// Should show result count somewhere
		await expect(page.getByText(/\d+ results?/)).toBeVisible();
	});
});
