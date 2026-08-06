import { expect, test } from "@playwright/test";
import { SearchBoxPage } from "./pages/SearchBoxPage";

/**
 * Tests for the AnswerBox component that appears on quantitative queries.
 * Uses route interception to provide controlled API responses with answer data.
 */
test.describe("AnswerBox for quantitative queries", () => {
	const MOCK_SEARCH_RESPONSE = {
		data: [
			{
				id: 1,
				property_id: "R123456",
				geo_id: "0220010101",
				name: "Test Owner",
				property_address: "123 Oak St",
				city: "Austin",
				prop_type: "Real",
				appraised_value: 500000,
				assessed_value: 450000,
				description: "LOT 1 BLK A",
				scraped_at: "2026-01-15T00:00:00Z",
				updated_at: "2026-01-15T00:00:00Z",
				created_at: "2025-06-01T00:00:00Z",
			},
		],
		pagination: { total: 42, limit: 50, offset: 0, hasMore: false },
		query: {
			original: "average value on Oak Street",
			explanation: "Properties on Oak Street",
			answer: "The average property value on Oak Street is $487,000",
			answerType: "statistics",
			statistics: {
				avgValue: 487000,
				totalValue: 20454000,
				priceRange: { min: 150000, max: 1200000 },
			},
		},
	};

	test("shows answer box with AI answer text", async ({ page }) => {
		const search = new SearchBoxPage(page);
		await search.goto();

		await page.route("**/api/properties/search**", (route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(MOCK_SEARCH_RESPONSE),
			}),
		);

		await search.search("average value on Oak Street");

		// AnswerBox should appear with the answer
		await expect(page.getByText("Answer").first()).toBeVisible({
			timeout: 10_000,
		});
		await expect(page.getByText(/average property value/i)).toBeVisible();
	});

	test("shows statistics grid with average and total values", async ({
		page,
	}) => {
		const search = new SearchBoxPage(page);
		await search.goto();

		await page.route("**/api/properties/search**", (route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(MOCK_SEARCH_RESPONSE),
			}),
		);

		await search.search("average value on Oak Street");

		await expect(page.getByText("Average Value")).toBeVisible({
			timeout: 10_000,
		});
		await expect(page.getByText("Total Value")).toBeVisible();
		await expect(page.getByText("Value Range")).toBeVisible();
	});

	test("shows AI indicator badge", async ({ page }) => {
		const search = new SearchBoxPage(page);
		await search.goto();

		await page.route("**/api/properties/search**", (route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(MOCK_SEARCH_RESPONSE),
			}),
		);

		await search.search("average value");

		await expect(page.getByText("AI Answer")).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText("42 results")).toBeVisible();
	});

	test("shows loading state while processing", async ({ page }) => {
		const search = new SearchBoxPage(page);

		// Complete the initial load immediately so it doesn't race with the search
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

		// Hold the search response to observe loading
		let fulfillRoute: (() => void) | undefined;
		await page.route("**/api/properties/search**", async (route) => {
			await new Promise<void>((resolve) => {
				fulfillRoute = resolve;
			});
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(MOCK_SEARCH_RESPONSE),
			});
		});

		await search.search("average value");

		// Loading indicator should appear
		await expect(search.searchbox).toHaveAttribute("aria-busy", "true");

		// Release
		fulfillRoute?.();
	});

	test("does not show answer box for non-quantitative queries", async ({
		page,
	}) => {
		const search = new SearchBoxPage(page);
		await search.goto();

		// Response without answer data
		await page.route("**/api/properties/search**", (route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					data: MOCK_SEARCH_RESPONSE.data,
					pagination: { total: 1, limit: 50, offset: 0, hasMore: false },
					query: {
						original: "Oak Street",
						explanation: "Properties matching Oak Street",
					},
				}),
			}),
		);

		await search.search("Oak Street");

		// Results should appear but no Answer box
		await expect(
			page.getByRole("button", { name: /show details/i }).first(),
		).toBeVisible({ timeout: 10_000 });
		await expect(
			page.getByRole("status", { name: /AI-generated answer/i }),
		).not.toBeVisible();
	});
});
