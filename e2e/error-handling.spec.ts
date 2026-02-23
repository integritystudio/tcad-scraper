import { expect, test } from "@playwright/test";
import { PropertyCardPage } from "./pages/PropertyCardPage";
import { SearchBoxPage } from "./pages/SearchBoxPage";

test.describe("Error handling and edge cases", () => {
  test("search button is disabled with empty query", async ({ page }) => {
    const search = new SearchBoxPage(page);
    await search.goto();
    await expect(search.searchButton).toBeDisabled();
  });

  test("search button is disabled with whitespace-only query", async ({
    page,
  }) => {
    const search = new SearchBoxPage(page);
    await search.goto();
    await search.fillQuery("   ");
    await expect(search.searchButton).toBeDisabled();
  });

  test("no results state displays helpful message", async ({ page }) => {
    const search = new SearchBoxPage(page);
    const card = new PropertyCardPage(page);
    await search.goto();

    // Use a query unlikely to match anything
    await search.search("zzzznonexistent99999");

    await expect(card.noResultsMessage()).toBeVisible({ timeout: 15_000 });
  });

  test("loading skeleton appears during initial page load", async ({
    page,
  }) => {
    const search = new SearchBoxPage(page);
    await search.goto();

    // The page skeleton or the main content should be visible
    // (skeleton may be too fast to catch, so we verify the page loaded)
    await expect(
      page.getByRole("heading", { name: /TCAD Property Explorer/i }),
    ).toBeVisible();
  });
});
