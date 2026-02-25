import { expect, test } from "@playwright/test";
import { SearchBoxPage } from "./pages/SearchBoxPage";

/**
 * Visual regression tests using Playwright's built-in screenshot comparison.
 * On first run, snapshots are created in e2e/visual.spec.ts-snapshots/.
 * On subsequent runs, screenshots are compared to the stored baseline.
 *
 * To update snapshots after an intentional UI change:
 *   npx playwright test e2e/visual.spec.ts --update-snapshots
 */
test.describe("Visual regression", () => {
  test("home page matches snapshot", async ({ page }) => {
    await page.goto("/");
    // Wait for the page heading so the UI is stable before capturing
    await page.getByRole("heading", { name: /TCAD Property Explorer/i }).waitFor();

    await expect(page).toHaveScreenshot("home-page.png", {
      fullPage: false,
      maxDiffPixelRatio: 0.02, // Allow 2% pixel drift (anti-aliasing, fonts)
    });
  });

  test("search results match snapshot", async ({ page }) => {
    const search = new SearchBoxPage(page);
    await search.goto();
    await search.search("Oak Street");

    await expect(
      page.getByText("No properties found").or(page.locator(".results-grid h3").first()),
    ).toBeVisible({ timeout: 15_000 });

    await expect(page).toHaveScreenshot("search-results.png", {
      fullPage: false,
      maxDiffPixelRatio: 0.02,
    });
  });
});
