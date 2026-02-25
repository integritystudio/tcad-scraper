import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { SearchBoxPage } from "./pages/SearchBoxPage";

/**
 * Automated WCAG 2.1 accessibility checks using axe-core.
 * Covers the main page and post-search results state.
 */
test.describe("Accessibility (axe-core)", () => {
  test("home page has no critical a11y violations", async ({ page }) => {
    await page.goto("/");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("search results page has no critical a11y violations", async ({
    page,
  }) => {
    const search = new SearchBoxPage(page);
    await search.goto();
    await search.search("Oak Street");

    // Wait for results or no-results state to appear
    await expect(
      page.getByText("No properties found").or(page.locator(".results-grid h3").first()),
    ).toBeVisible({ timeout: 15_000 });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
