import { expect, test } from "@playwright/test";
import { PropertyCardPage } from "./pages/PropertyCardPage";
import { SearchBoxPage } from "./pages/SearchBoxPage";

test.describe("Property card expand/collapse", () => {
  async function searchForProperties(
    search: SearchBoxPage,
    card: PropertyCardPage,
  ) {
    await search.goto();
    await search.search("Oak Street");
    await card.waitForResults();
  }

  test("expand button shows details and updates aria-expanded", async ({
    page,
  }) => {
    const search = new SearchBoxPage(page);
    const card = new PropertyCardPage(page);
    await searchForProperties(search, card);

    // Should start collapsed
    await expect(card.firstExpandButton()).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    await card.expandFirst();

    // After click, should be expanded
    await expect(card.firstHideButton()).toHaveAttribute("aria-expanded", "true");
  });

  test("collapse button hides details", async ({ page }) => {
    const search = new SearchBoxPage(page);
    const card = new PropertyCardPage(page);
    await searchForProperties(search, card);

    await card.expandFirst();
    await card.collapseFirst();

    // Should be back to collapsed
    await expect(card.firstExpandButton()).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  test("expanded card shows financial breakdown section", async ({ page }) => {
    const search = new SearchBoxPage(page);
    const card = new PropertyCardPage(page);
    await searchForProperties(search, card);

    await card.expandFirst();

    await expect(page.getByText("Financial Breakdown").first()).toBeVisible();
  });
});
