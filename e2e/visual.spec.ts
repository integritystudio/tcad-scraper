import { expect, test } from "@playwright/test";
import { SearchBoxPage } from "./pages/SearchBoxPage";

/**
 * Visual regression tests using Playwright's built-in screenshot comparison.
 * On first run, snapshots are created in e2e/visual.spec.ts-snapshots/.
 * On subsequent runs, screenshots are compared to the stored baseline.
 *
 * To update snapshots after an intentional UI change:
 *   npx playwright test e2e/visual.spec.ts --update-snapshots
 */

/**
 * Playwright keys each snapshot by OS — `home-page-chromium-darwin.png` — and
 * only darwin baselines are committed, so these tests are macOS-only. Running
 * them on CI's ubuntu runner fails all 6 (2 tests x 3 browsers) with "A
 * snapshot doesn't exist ...-linux.png" rather than a real visual diff.
 *
 * TODO: add linux and windows baselines so this runs everywhere. Generating
 * them means capturing on each OS (a CI job with --update-snapshots, uploading
 * the PNGs as an artifact to commit) — fonts and anti-aliasing differ enough
 * per platform that a darwin baseline cannot simply be reused.
 */
const SNAPSHOT_PLATFORM = "darwin";

test.describe("Visual regression", () => {
	test.skip(
		process.platform !== SNAPSHOT_PLATFORM,
		`Snapshot baselines exist only for ${SNAPSHOT_PLATFORM}; see TODO above`,
	);

	test("home page matches snapshot", async ({ page }) => {
		await page.goto("/");
		// Wait for the page heading so the UI is stable before capturing
		await page
			.getByRole("heading", { name: /TCAD Property Explorer/i })
			.waitFor();

		await expect(page).toHaveScreenshot("home-page.png", {
			fullPage: false,
			maxDiffPixelRatio: 0.02, // Allow 2% pixel drift (anti-aliasing, fonts)
		});
	});

	test("search results match snapshot", async ({ page }) => {
		const search = new SearchBoxPage(page);
		await search.goto();
		await search.search("Oak Street");

		await expect(
			page
				.getByText("No properties found")
				.or(page.getByRole("button", { name: /show details/i }).first()),
		).toBeVisible({ timeout: 15_000 });

		await expect(page).toHaveScreenshot("search-results.png", {
			fullPage: false,
			maxDiffPixelRatio: 0.02,
		});
	});
});
