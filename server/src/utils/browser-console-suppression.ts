/**
 * Browser Console Suppression Utility
 *
 * Suppresses harmless browser console warnings from third-party websites
 * that are scraped via Playwright automation.
 *
 * Common suppressed warnings:
 * - Deprecated unload event listeners
 * - Message channel closed errors
 * - Chrome feature deprecation notices
 *
 * These warnings originate from the TCAD website (travis.prodigycad.com)
 * and are not fixable from our side. They don't affect scraping functionality.
 */

import type { Page } from "playwright";
import type winston from "winston";

/**
 * Patterns to suppress in browser console messages
 */
const SUPPRESSED_PATTERNS = [
	"Deprecated feature",
	"Unload event listeners",
	"message channel closed",
];

/**
 * Check if a message should be suppressed
 */
function shouldSuppressMessage(text: string): boolean {
	return SUPPRESSED_PATTERNS.some((pattern) => text.includes(pattern));
}

/**
 * Setup console message filtering on a Playwright page
 *
 * This will:
 * 1. Suppress known harmless warnings from third-party websites
 * 2. Log other console errors at debug level for troubleshooting
 * 3. Prevent browser page errors from cluttering application logs
 *
 * @param page - Playwright Page instance
 * @param logger - Optional Winston logger instance for debug logging
 *
 * @example
 * ```typescript
 * const page = await context.newPage();
 * suppressBrowserConsoleWarnings(page, logger);
 * ```
 */
export function suppressBrowserConsoleWarnings(
	page: Page,
	logger?: winston.Logger,
): void {
	// Suppress browser console messages
	page.on("console", (msg) => {
		const text = msg.text();

		// Filter out known harmless warnings
		if (shouldSuppressMessage(text)) {
			return;
		}

		// Log other console messages for debugging (if logger provided)
		if (logger && msg.type() === "error") {
			logger.debug(`Browser console error: ${text}`);
		}
	});

	// Suppress page errors that aren't critical
	page.on("pageerror", (error) => {
		const errorMsg = error.message;

		// Filter out known harmless errors
		if (shouldSuppressMessage(errorMsg)) {
			return;
		}

		// Log other page errors for debugging (if logger provided)
		if (logger) {
			logger.debug(`Browser page error: ${errorMsg}`);
		}
	});
}

/**
 * Add a custom pattern to the suppression list
 *
 * Use this if you discover new harmless warnings that should be suppressed.
 *
 * @param pattern - String pattern to match against console messages
 *
 * @example
 * ```typescript
 * addSuppressionPattern('New Chrome warning');
 * ```
 */
export function addSuppressionPattern(pattern: string): void {
	if (!SUPPRESSED_PATTERNS.includes(pattern)) {
		SUPPRESSED_PATTERNS.push(pattern);
	}
}

/**
 * Get current suppression patterns (for debugging)
 */
export function getSuppressionPatterns(): readonly string[] {
	return Object.freeze([...SUPPRESSED_PATTERNS]);
}
