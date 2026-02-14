/**
 * Shared browser launch configuration for Playwright.
 * Centralizes chromium launch options used by tcad-scraper and token-refresh.
 */

import { type Browser, chromium, type LaunchOptions } from "playwright";
import { config } from "../config";
import logger from "./logger";

/** Standard Chromium args for anti-detection and sandboxing */
const CHROMIUM_ARGS = [
	"--disable-blink-features=AutomationControlled",
	"--disable-web-security",
	"--disable-features=IsolateOrigins,site-per-process",
	"--no-sandbox",
	"--disable-setuid-sandbox",
];

export interface BrowserLaunchOptions {
	proxy?: {
		server: string;
		username?: string;
		password?: string;
	};
}

/**
 * Launch a Chromium browser with standard TCAD scraping configuration.
 */
export async function launchTCADBrowser(
	options?: BrowserLaunchOptions,
): Promise<Browser> {
	const launchOptions: LaunchOptions = {
		headless: config.scraper.headless,
		executablePath:
			process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
		args: CHROMIUM_ARGS,
	};

	if (options?.proxy) {
		launchOptions.proxy = {
			server: options.proxy.server,
			username: options.proxy.username,
			password: options.proxy.password,
		};
		logger.info(`Using proxy: ${options.proxy.server}`);
	}

	const browser = await chromium.launch(launchOptions);
	logger.info("Browser initialized successfully");
	return browser;
}
