import type { Locator, Page } from "@playwright/test";

const RESULTS_TIMEOUT = 30_000;

/**
 * Page object for interacting with PropertyCard components in the results grid.
 */
export class PropertyCardPage {
	constructor(private readonly page: Page) {}

	/** Wait for at least one property card expand button to appear (only present when real results load) */
	async waitForResults() {
		await this.page
			.getByRole("button", { name: /show details/i })
			.first()
			.waitFor({ timeout: RESULTS_TIMEOUT });
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
		// Wait for expansion to complete (hide button visible = animation settled)
		await this.firstHideButton().waitFor({ state: "visible" });
	}

	async collapseFirst() {
		const hideBtn = this.firstHideButton();
		await hideBtn.waitFor({ state: "visible" });
		await hideBtn.click();
		// Wait for collapse to complete
		await this.firstExpandButton().waitFor({ state: "visible" });
	}

	noResultsMessage(): Locator {
		return this.page.getByText("No properties found");
	}
}
