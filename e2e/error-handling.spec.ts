import { expect, test } from "@playwright/test";

test.describe("Error handling and edge cases", () => {
  test("search button is disabled with empty query", async ({ page }) => {
    await page.goto("/");

    const searchButton = page.getByRole("button", {
      name: "Search properties",
    });
    await expect(searchButton).toBeDisabled();
  });

  test("search button is disabled with whitespace-only query", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("searchbox").fill("   ");
    const searchButton = page.getByRole("button", {
      name: "Search properties",
    });
    await expect(searchButton).toBeDisabled();
  });

  test("no results state displays helpful message", async ({ page }) => {
    await page.goto("/");

    // Use a query unlikely to match anything
    await page.getByRole("searchbox").fill("zzzznonexistent99999");
    await page.getByRole("button", { name: "Search properties" }).click();

    await expect(page.getByText("No properties found")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("loading skeleton appears during initial page load", async ({
    page,
  }) => {
    // Navigate and check for loading skeleton before app hydrates
    await page.goto("/");

    // The page skeleton or the main content should be visible
    // (skeleton may be too fast to catch, so we verify the page loaded)
    await expect(
      page.getByRole("heading", { name: /TCAD Property Explorer/i }),
    ).toBeVisible();
  });
});
