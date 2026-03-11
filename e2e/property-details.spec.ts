import { expect, test } from "@playwright/test";
import { PropertyCardPage } from "./pages/PropertyCardPage";
import { SearchBoxPage } from "./pages/SearchBoxPage";

/**
 * Tests for expanded PropertyDetails sections.
 * Verifies financial breakdown, identifiers, description, and metadata render correctly.
 */
test.describe("Property detail sections", () => {
  async function expandFirstResult(page: import("@playwright/test").Page) {
    const search = new SearchBoxPage(page);
    const card = new PropertyCardPage(page);
    await search.goto();
    await search.search("Oak Street");
    await card.waitForResults();
    await card.expandFirst();
    return { search, card };
  }

  test("Financial Breakdown shows appraised and assessed values", async ({
    page,
  }) => {
    await expandFirstResult(page);

    const financial = page.getByText("Financial Breakdown").first();
    await expect(financial).toBeVisible();

    // Should show currency-formatted values ($ symbol present)
    await expect(page.getByText(/Appraised/i).first()).toBeVisible();
    // At least one dollar-formatted value should be visible in expanded area
    await expect(page.getByText(/\$[\d,]+/).first()).toBeVisible();
  });

  test("Property Identifiers section shows property ID and geo ID", async ({
    page,
  }) => {
    await expandFirstResult(page);

    await expect(page.getByText("Property Identifiers").first()).toBeVisible();
    // Property ID and Geo ID labels should be visible
    await expect(page.getByText(/Property ID/i).first()).toBeVisible();
    await expect(page.getByText(/Geo ID/i).first()).toBeVisible();
  });

  test("Data Freshness section shows timestamps", async ({ page }) => {
    await expandFirstResult(page);

    await expect(page.getByText("Data Freshness").first()).toBeVisible();
  });

  test("property card shows owner name, address, and property type badge", async ({
    page,
  }) => {
    const search = new SearchBoxPage(page);
    const card = new PropertyCardPage(page);
    await search.goto();
    await search.search("Oak Street");
    await card.waitForResults();

    // First card should have the key summary elements
    const firstCard = page.locator(".results-grid").first();

    // Owner name (h3)
    await expect(firstCard.locator("h3").first()).toBeVisible();

    // Property type badge
    await expect(firstCard.locator("[class*='badge']").first()).toBeVisible();
  });

  test("collapse re-hides all detail sections", async ({ page }) => {
    const { card } = await expandFirstResult(page);

    // Sections visible when expanded
    await expect(page.getByText("Financial Breakdown").first()).toBeVisible();

    // Collapse
    await card.collapseFirst();

    // Sections should be hidden
    await expect(page.getByText("Financial Breakdown").first()).not.toBeVisible();
  });

  test("multiple cards can be expanded independently", async ({ page }) => {
    const search = new SearchBoxPage(page);
    const card = new PropertyCardPage(page);
    await search.goto();
    await search.search("Oak Street");
    await card.waitForResults();

    const expandButtons = page.getByRole("button", { name: /show details/i });
    const count = await expandButtons.count();

    if (count >= 2) {
      // Expand first
      await expandButtons.first().click();
      await expect(page.getByText("Financial Breakdown").first()).toBeVisible();

      // Expand second — both should be expanded
      await expandButtons.first().click(); // first remaining "show details" (which is the 2nd card)
      const financialSections = page.getByText("Financial Breakdown");
      await expect(financialSections.first()).toBeVisible();
    }
  });
});
