import { config as appConfig } from "../config";
import { tokenRefreshService } from "../services/token-refresh.service";
import type { PropertyData, ScraperConfig } from "../types";
import { getErrorMessage } from "../utils/error-helpers";
import logger from "./logger";
import {
	fetchTCADProperties,
	mapTCADResultToPropertyData,
	type TCADApiResponse,
	type TCADPropertyResult,
} from "./tcad-api-client";

export type { TCADApiResponse, TCADPropertyResult };

export class TCADScraper {
	private config: ScraperConfig;

	constructor(config?: Partial<ScraperConfig>) {
		this.config = {
			timeout: appConfig.scraper.timeout,
			retryAttempts: appConfig.scraper.retryAttempts,
			retryDelay: appConfig.scraper.retryDelay,
			...config,
		};
	}

	async initialize(): Promise<void> {
		const token =
			tokenRefreshService.getCurrentToken() ||
			appConfig.scraper.tcadApiKey ||
			null;

		if (!token) {
			throw new Error(
				"No TCAD API token available. Set TCAD_API_KEY in environment.",
			);
		}

		logger.info("TCADScraper initialized (API-direct mode)");
	}

	/**
	 * Scrape properties using direct API calls via Node.js fetch.
	 */
	async scrapePropertiesViaAPI(
		searchTerm: string,
		maxRetries: number = this.config.retryAttempts,
	): Promise<PropertyData[]> {
		const authToken =
			tokenRefreshService.getCurrentToken() ||
			appConfig.scraper.tcadApiKey ||
			null;

		if (!authToken) {
			throw new Error(
				"No TCAD API token available. Set TCAD_API_KEY in environment.",
			);
		}

		let lastError: Error | null = null;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				logger.info(
					`API-direct scraping attempt ${attempt} for: ${searchTerm}`,
				);

				const response = await fetchTCADProperties(
					authToken,
					searchTerm,
					appConfig.scraper.tcadYear,
				);

				logger.info(
					`API returned ${response.totalCount} total properties, fetched ${response.results.length} results (pageSize: ${response.pageSize})`,
				);

				const properties = response.results.map(mapTCADResultToPropertyData);
				logger.info(`Extracted ${properties.length} properties via API-direct`);
				return properties;
			} catch (error) {
				lastError = error as Error;
				logger.error(
					`API-direct attempt ${attempt} failed: %s`,
					getErrorMessage(error),
				);

				if (attempt < maxRetries) {
					const delay = this.config.retryDelay * 2 ** (attempt - 1);
					logger.info(`Retrying in ${delay}ms...`);
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
			}
		}

		throw lastError || new Error("All API-direct scraping attempts failed");
	}

	async cleanup(): Promise<void> {
		// No-op: no browser resources to clean up
	}
}
