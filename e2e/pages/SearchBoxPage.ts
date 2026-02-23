import type { Locator, Page } from "@playwright/test";

/**
 * Page object for the SearchBox component.
 * Encapsulates all interactions with the search input and button.
 */
export class SearchBoxPage {
  readonly searchbox: Locator;
  readonly searchButton: Locator;

  constructor(private readonly page: Page) {
    this.searchbox = page.getByRole("searchbox");
    this.searchButton = page.getByRole("button", { name: "Search properties" });
  }

  async goto() {
    await this.page.goto("/");
  }

  async fillQuery(query: string) {
    await this.searchbox.fill(query);
  }

  async submit() {
    await this.searchButton.click();
  }

  async search(query: string) {
    await this.fillQuery(query);
    await this.submit();
  }
}
