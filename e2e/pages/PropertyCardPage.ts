import type { Locator, Page } from "@playwright/test";

const RESULTS_TIMEOUT = 15_000;

/**
 * Page object for interacting with PropertyCard components in the results grid.
 */
export class PropertyCardPage {
  constructor(private readonly page: Page) {}

  /** Wait for at least one property card heading to appear */
  async waitForResults() {
    await this.page.locator("h3").first().waitFor({ timeout: RESULTS_TIMEOUT });
  }

  /** First expand button in the results list */
  firstExpandButton(): Locator {
    return this.page.getByRole("button", { name: /show details/i }).first();
  }

  /** First hide/collapse button in the results list */
  firstHideButton(): Locator {
    return this.page.getByRole("button", { name: /hide details/i }).first();
  }

  async expandFirst() {
    await this.firstExpandButton().click();
  }

  async collapseFirst() {
    await this.firstHideButton().click();
  }

  noResultsMessage(): Locator {
    return this.page.getByText("No properties found");
  }
}
