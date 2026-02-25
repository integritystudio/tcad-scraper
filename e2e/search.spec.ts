import { expect, test } from "@playwright/test";
import { SearchBoxPage } from "./pages/SearchBoxPage";

test.describe("Search happy path", () => {
  test("search input and button are visible on load", async ({ page }) => {
    const search = new SearchBoxPage(page);
    await search.goto();
    await expect(search.searchbox).toBeVisible();
    await expect(search.searchButton).toBeVisible();
  });

  test("typing a query enables the search button", async ({ page }) => {
    const search = new SearchBoxPage(page);
    await search.goto();

    // Button disabled with empty input
    await expect(search.searchButton).toBeDisabled();

    // Type a query
    await search.fillQuery("Oak Street");
    await expect(search.searchButton).toBeEnabled();
  });

  test("submitting a search shows results or no-results state", async ({
    page,
  }) => {
    const search = new SearchBoxPage(page);
    await search.goto();
    await search.search("Oak Street");

    // Wait for either results grid or no-results message
    await expect(
      page.getByText("No properties found").or(page.locator(".results-grid h3").first()),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("search input shows loading state during request", async ({
    page,
  }) => {
    const search = new SearchBoxPage(page);
    await search.goto();

    // Hold API response so we can reliably observe loading state
    let fulfillRoute: (() => void) | undefined;
    await page.route("**/api/**", async (route) => {
      await new Promise<void>((resolve) => { fulfillRoute = resolve; });
      await route.continue();
    });

    await search.search("Austin properties");

    // Request is in-flight — assert loading state
    await expect(search.searchbox).toHaveAttribute("aria-busy", "true");

    // Release the API response
    fulfillRoute!();
  });

  test("page heading is visible", async ({ page }) => {
    const search = new SearchBoxPage(page);
    await search.goto();
    await expect(
      page.getByRole("heading", { name: /TCAD Property Explorer/i }),
    ).toBeVisible();
  });
});
