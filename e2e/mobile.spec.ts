import { expect, test } from "@playwright/test";
import { SearchBoxPage } from "./pages/SearchBoxPage";
import { PropertyCardPage } from "./pages/PropertyCardPage";

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
    await expect(page.getByRole("button", { name: "Search properties" })).toBeVisible();
  });

  test("search works on mobile", async ({ page }) => {
    const search = new SearchBoxPage(page);
    await search.goto();
    await search.search("Oak Street");

    await expect(
      page.getByText("No properties found").or(page.locator(".results-grid h3").first()),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("property card expand/collapse works on mobile", async ({ page }) => {
    const search = new SearchBoxPage(page);
    const card = new PropertyCardPage(page);
    await search.goto();
    await search.search("Oak Street");
    await card.waitForResults();

    await card.expandFirst();
    await expect(page.getByText("Financial Breakdown").first()).toBeVisible();

    await card.collapseFirst();
    await expect(page.getByText("Financial Breakdown").first()).not.toBeVisible();
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
    const card = new PropertyCardPage(page);
    await search.goto();
    await search.search("Oak Street");

    await expect(
      page.getByText("No properties found").or(page.locator(".results-grid h3").first()),
    ).toBeVisible({ timeout: 15_000 });
  });
});
