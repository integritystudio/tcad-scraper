import { expect, test } from "@playwright/test";

test.describe("Property card expand/collapse", () => {
  // Helper: perform a search to get property cards on screen
  async function searchForProperties(
    page: import("@playwright/test").Page,
  ) {
    await page.goto("/");
    await page.getByRole("searchbox").fill("Oak Street");
    await page.getByRole("button", { name: "Search properties" }).click();

    // Wait for results to load
    await page.locator("h3").first().waitFor({ timeout: 15_000 });
  }

  test("expand button shows details and updates aria-expanded", async ({
    page,
  }) => {
    await searchForProperties(page);

    const expandButton = page
      .getByRole("button", { name: /show details/i })
      .first();

    // Should start collapsed
    await expect(expandButton).toHaveAttribute("aria-expanded", "false");

    await expandButton.click();

    // After click, should be expanded
    const hideButton = page
      .getByRole("button", { name: /hide details/i })
      .first();
    await expect(hideButton).toHaveAttribute("aria-expanded", "true");
  });

  test("collapse button hides details", async ({ page }) => {
    await searchForProperties(page);

    // Expand first card
    const expandButton = page
      .getByRole("button", { name: /show details/i })
      .first();
    await expandButton.click();

    // Collapse it
    const hideButton = page
      .getByRole("button", { name: /hide details/i })
      .first();
    await hideButton.click();

    // Should be back to collapsed
    await expect(
      page.getByRole("button", { name: /show details/i }).first(),
    ).toHaveAttribute("aria-expanded", "false");
  });

  test("expanded card shows financial breakdown section", async ({
    page,
  }) => {
    await searchForProperties(page);

    await page
      .getByRole("button", { name: /show details/i })
      .first()
      .click();

    await expect(page.getByText("Financial Breakdown").first()).toBeVisible();
  });
});
