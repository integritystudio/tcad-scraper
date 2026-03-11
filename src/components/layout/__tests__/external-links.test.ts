import { describe, expect, it } from "vitest";

/**
 * Verify all external links used across layout components resolve (HTTP 2xx/3xx).
 * Catches stale URLs after domain or path changes.
 */

const EXTERNAL_URLS: Record<string, string> = {
  "Integrity Studio homepage": "https://integritystudio.ai",
  "Contact page": "https://integritystudio.ai/contact",
  "Features page": "https://integritystudio.ai/features",
  "Blog": "https://integritystudio.ai/blog",
  "Portfolio / Reports": "https://www.aledlie.com/reports/",
  "GitHub repo": "https://github.com/integritystudio/tcad-scraper",
};

describe("external links resolve", () => {
  for (const [label, url] of Object.entries(EXTERNAL_URLS)) {
    it(`${label} (${url})`, async () => {
      const response = await fetch(url, { method: "HEAD", redirect: "follow" });
      expect(
        response.ok,
        `${url} returned ${response.status}`,
      ).toBe(true);
    });
  }
});
