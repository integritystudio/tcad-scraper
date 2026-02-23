import { expect, test } from "@playwright/test";

test.describe("Search happy path", () => {
  test("search input and button are visible on load", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("searchbox")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Search properties" }),
    ).toBeVisible();
  });

  test("typing a query enables the search button", async ({ page }) => {
    await page.goto("/");
    const searchButton = page.getByRole("button", {
      name: "Search properties",
    });

    // Button disabled with empty input
    await expect(searchButton).toBeDisabled();

    // Type a query
    await page.getByRole("searchbox").fill("Oak Street");
    await expect(searchButton).toBeEnabled();
  });

  test("submitting a search shows results or no-results state", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("searchbox").fill("Oak Street");
    await page.getByRole("button", { name: "Search properties" }).click();

    // Wait for either results grid or no-results message
    await expect(
      page.getByText("No properties found").or(page.locator("h3").first()),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("search input shows loading state during request", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("searchbox").fill("Austin properties");
    await page.getByRole("button", { name: "Search properties" }).click();

    // Input should show busy state while loading
    await expect(page.getByRole("searchbox")).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  test("page heading is visible", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /TCAD Property Explorer/i }),
    ).toBeVisible();
  });
});
