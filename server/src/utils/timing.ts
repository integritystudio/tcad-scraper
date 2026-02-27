/**
 * Shared timing utilities for delays in scraping operations.
 */

import logger from "../lib/logger";

const DEFAULT_MIN_DELAY = 100;
const DEFAULT_MAX_DELAY = 500;

/**
 * Wait for a random duration between min and max milliseconds.
 *
 * NOTE: trace logging is called per invocation (thousands of times per job).
 * Only enable trace level for targeted debugging, not in production.
 */
export async function humanDelay(
	min: number = DEFAULT_MIN_DELAY,
	max: number = DEFAULT_MAX_DELAY,
): Promise<void> {
	const delay = Math.floor(Math.random() * (max - min) + min);
	logger.trace({ delayMs: delay, min, max }, "humanDelay");
	await new Promise((resolve) => setTimeout(resolve, delay));
}
