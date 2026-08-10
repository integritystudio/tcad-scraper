import { describe, expect, it } from "vitest";

/**
 * Verify all external links used across layout components resolve (HTTP 2xx/3xx).
 * Catches stale URLs after domain or path changes.
 *
 * Deliberately NOT part of the frontend unit suite. It makes real network
 * calls, so it fails on transient conditions that say nothing about the code:
 * it took down a PR's coverage job with `ECONNRESET` against
 * integritystudio.ai on 2026-08-08, then passed on re-run. A unit suite that
 * goes red when someone else's DNS hiccups trains people to ignore it.
 *
 * It lives outside `src/` so `vite.config.ts`'s `include` glob skips it, and
 * runs on a weekly cron instead (.github/workflows/link-check.yml). A stale
 * URL is worth knowing about within a week; it is not worth blocking a merge.
 *
 * Run it directly with:
 *   npx vitest run --dir link-check --config link-check/vitest.config.ts
 */

const EXTERNAL_URLS: Record<string, string> = {
	"Integrity Studio homepage": "https://integritystudio.ai",
	"Contact page": "https://integritystudio.ai/contact",
	"Features page": "https://integritystudio.ai/features",
	Blog: "https://integritystudio.ai/blog",
	"Portfolio / Reports": "https://www.aledlie.com/reports/",
	"GitHub repo": "https://github.com/integritystudio/tcad-scraper",
};

describe("external links resolve", () => {
	for (const [label, url] of Object.entries(EXTERNAL_URLS)) {
		it(`${label} (${url})`, async () => {
			const response = await fetch(url, { method: "HEAD", redirect: "follow" });
			expect(response.ok, `${url} returned ${response.status}`).toBe(true);
		});
	}
});
