/**
 * Shared timing utilities for human-like delays in scraping operations.
 */

import { config as appConfig } from "../config";
import logger from "../lib/logger";

/**
 * Wait for a random duration between min and max milliseconds.
 * Used to simulate human-like interaction timing in browser automation.
 *
 * NOTE: trace logging is called per invocation (thousands of times per job).
 * Only enable trace level for targeted debugging, not in production.
 */
export async function humanDelay(
  min: number = appConfig.scraper.humanDelay.min,
  max: number = appConfig.scraper.humanDelay.max,
): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min) + min);
  logger.trace({ delayMs: delay, min, max }, "humanDelay");
  await new Promise((resolve) => setTimeout(resolve, delay));
}
