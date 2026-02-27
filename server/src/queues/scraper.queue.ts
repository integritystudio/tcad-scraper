import Bull from "bull";
import { config } from "../config";
import logger from "../lib/logger";
import { prisma } from "../lib/prisma";
import { cacheService } from "../lib/redis-cache.service";
import { TCADScraper } from "../lib/tcad-scraper";
import { searchTermOptimizer } from "../services/search-term-optimizer";
import { tcadTokenRefreshService } from "../services/token-refresh.service";
import type { ScrapeJobData, ScrapeJobResult } from "../types";
import { getErrorMessage } from "../utils/error-helpers";

// Build Redis connection options, supporting TLS for rediss:// URLs
function buildRedisConfig(): Bull.QueueOptions["redis"] {
	if (!config.redis.url) {
		return {
			host: config.redis.host,
			port: config.redis.port,
			password: config.redis.password,
			db: config.redis.db,
		};
	}
	if (config.redis.tls) {
		const parsed = new URL(config.redis.url);
		return {
			host: parsed.hostname,
			port: parseInt(parsed.port || "6379"),
			password: parsed.password,
			username: parsed.username,
			tls: { rejectUnauthorized: false },
		};
	}
	return config.redis.url;
}

// Create the Bull queue
export const scraperQueue = new Bull<ScrapeJobData>(config.queue.name, {
	redis: buildRedisConfig(),
	defaultJobOptions: {
		attempts: config.queue.defaultJobOptions.attempts,
		backoff: {
			type: "exponential",
			delay: config.queue.defaultJobOptions.backoffDelay,
		},
		removeOnComplete: config.queue.defaultJobOptions.removeOnComplete,
		removeOnFail: config.queue.defaultJobOptions.removeOnFail,
	},
});

// Process scraping jobs
scraperQueue.process(
	config.queue.jobName,
	config.queue.concurrency,
	async (job) => {
		const startTime = Date.now();
		const { searchTerm } = job.data;

		logger.info(
			`Processing scrape job ${job.id} for search term: ${searchTerm}`,
		);

		// Create a job record in the database
		const scrapeJob = await prisma.scrapeJob.create({
			data: {
				searchTerm,
				status: "processing",
			},
		});

		const scraper = new TCADScraper();

		try {
			// Update progress: Initializing
			await job.progress(10);
			await scraper.initialize();

			// Update progress: Scraping
			// Using API-based scraping for better results (up to 1000x more properties)
			await job.progress(30);
			const properties = await scraper.scrapePropertiesViaAPI(searchTerm);

			// Update progress: Saving to database
			await job.progress(70);

			// Batch upsert properties to database using PostgreSQL's ON CONFLICT
			// This is 10-50x faster than individual upserts
			let savedCount = 0;

			if (properties.length > 0) {
				const CHUNK_SIZE = config.queue.batchChunkSize;

				for (let i = 0; i < properties.length; i += CHUNK_SIZE) {
					const chunk = properties.slice(i, i + CHUNK_SIZE);

					// Build the VALUES clause dynamically
					const now = new Date();
					const valuesClauses: string[] = [];
					const params: (string | number | Date | null)[] = [];
					let paramIndex = 1;

					const year = config.scraper.tcadYear; // number; SQL parameterization handles coercion

					for (const property of chunk) {
						valuesClauses.push(
							`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, ` +
								`$${paramIndex + 5}, COALESCE($${paramIndex + 6}, 0), $${paramIndex + 7}, $${paramIndex + 8}, ` +
								`$${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11}, $${paramIndex + 12}, $${paramIndex + 13})`,
						);

						params.push(
							property.propertyId,
							property.name,
							property.propType,
							property.city,
							property.propertyAddress,
							property.assessedValue,
							property.appraisedValue || 0,
							property.geoId,
							property.description,
							searchTerm,
							year,
							now,
							now,
							now,
						);

						paramIndex += 14;
					}

					// SECURITY: $queryRawUnsafe is safe here — all user-supplied data
					// (property fields, searchTerm) is passed via the parameterized
					// `params` array ($1, $2, ...). Column names, table name, and SQL
					// structure are hard-coded constants, not derived from user input.
					const sql = `
          INSERT INTO properties (
            property_id, name, prop_type, city, property_address,
            assessed_value, appraised_value, geo_id, description,
            search_term, year, scraped_at, created_at, updated_at
          )
          VALUES ${valuesClauses.join(", ")}
          ON CONFLICT (property_id, year) DO UPDATE SET
            name = EXCLUDED.name,
            prop_type = EXCLUDED.prop_type,
            city = EXCLUDED.city,
            property_address = EXCLUDED.property_address,
            assessed_value = EXCLUDED.assessed_value,
            appraised_value = EXCLUDED.appraised_value,
            geo_id = EXCLUDED.geo_id,
            description = EXCLUDED.description,
            search_term = EXCLUDED.search_term,
            scraped_at = EXCLUDED.scraped_at,
            updated_at = EXCLUDED.updated_at
          RETURNING (xmax = 0) AS inserted
        `;

					// Execute query and get result indicating which were INSERTs (new) vs UPDATEs (existing)
					const result = await prisma.$queryRawUnsafe<{ inserted: boolean }[]>(
						sql,
						...params,
					);

					// Count only the actual new properties (INSERTs)
					const newPropertyCount = result.filter((r) => r.inserted).length;
					const updatedPropertyCount = result.length - newPropertyCount;

					savedCount += newPropertyCount;
					logger.info(
						`Batch processed ${chunk.length} properties: ` +
							`${newPropertyCount} new, ${updatedPropertyCount} updated ` +
							`(${savedCount}/${properties.length} new total)`,
					);
				}
			}

			// savedCount now contains the actual number of NEW properties inserted (not updates)
			const totalScraped = properties.length;
			const totalUpdated = totalScraped - savedCount;

			// Update progress: Complete
			await job.progress(100);

			// Log final results with breakdown
			logger.info(
				`Scrape complete for "${searchTerm}": ` +
					`${savedCount} new properties, ${totalUpdated} updated, ${totalScraped} total processed`,
			);

			// Update job record with ACTUAL new property count (not total scraped)
			await prisma.scrapeJob.update({
				where: { id: scrapeJob.id },
				data: {
					status: "completed",
					resultCount: savedCount, // ✅ FIX: Report actual NEW properties, not total scraped
					completedAt: new Date(),
				},
			});

			// Update search term analytics with ACTUAL new properties (for optimization)
			await searchTermOptimizer.updateAnalytics(
				searchTerm,
				savedCount, // ✅ FIX: Use actual new count, not total scraped
				true, // wasSuccessful
			);

			// Invalidate caches since new properties were added
			logger.info("Invalidating caches after successful scrape...");
			await Promise.all([
				cacheService.deletePattern("properties:list:*"), // Invalidate all list queries
				cacheService.delete("properties:stats:all"), // Invalidate statistics
			]);
			logger.info("Caches invalidated successfully");

			const duration = Date.now() - startTime;
			const result: ScrapeJobResult = {
				count: savedCount, // ✅ FIX: Report actual NEW properties saved
				properties: properties, // Return all scraped properties for reference
				searchTerm,
				duration,
			};

			logger.info(
				`Job ${job.id} completed successfully: ` +
					`${savedCount} new properties saved (${totalUpdated} duplicates updated) in ${duration}ms`,
			);

			return result;
		} catch (error) {
			const errorMessage = getErrorMessage(error);
			logger.error(`Job ${job.id} failed: %s`, errorMessage);

			// Check if this is a token expiration error - trigger refresh before retry
			if (
				errorMessage.includes("TOKEN_EXPIRED") ||
				errorMessage.includes("HTTP 401")
			) {
				logger.warn(
					`Job ${job.id}: Token expired, triggering refresh before retry...`,
				);
				try {
					await tcadTokenRefreshService.refreshToken();
					logger.info(
						`Job ${job.id}: Token refreshed successfully, job will retry`,
					);
				} catch (refreshError) {
					logger.error(
						`Job ${job.id}: Token refresh failed: %s`,
						getErrorMessage(refreshError),
					);
				}
			}

			// Update job record with error
			await prisma.scrapeJob.update({
				where: { id: scrapeJob.id },
				data: {
					status: "failed",
					error: errorMessage,
					completedAt: new Date(),
				},
			});

			// Update search term analytics for failed job
			await searchTermOptimizer.updateAnalytics(
				searchTerm,
				0, // resultCount
				false, // wasSuccessful
				errorMessage,
			);

			throw error;
		} finally {
			await scraper.cleanup();
		}
	},
);

// Event listeners for queue monitoring
scraperQueue.on("completed", (job, result: ScrapeJobResult) => {
	logger.info(
		`Job ${job.id} completed with ${result.count} properties in ${result.duration}ms`,
	);
});

scraperQueue.on("failed", (job, err) => {
	logger.error(
		`Job ${job.id} failed after ${job.attemptsMade} attempts: %s`,
		getErrorMessage(err),
	);
});

scraperQueue.on("stalled", (job) => {
	logger.warn(`Job ${job.id} stalled and will be retried`);
});

// Clean up old jobs periodically
setInterval(async () => {
	try {
		await scraperQueue.clean(config.queue.cleanupGracePeriod, "completed");
		await scraperQueue.clean(config.queue.cleanupGracePeriod, "failed");
		logger.info("Cleaned old jobs from queue");
	} catch (error) {
		logger.error("Failed to clean queue: %s", getErrorMessage(error));
	}
}, config.queue.cleanupInterval);

// Rate limiting helper
const activeJobs = new Map<string, number>();

export async function canScheduleJob(searchTerm: string): Promise<boolean> {
	const lastJobTime = activeJobs.get(searchTerm);

	if (
		lastJobTime &&
		Date.now() - lastJobTime < config.rateLimit.scraper.jobDelay
	) {
		return false;
	}

	activeJobs.set(searchTerm, Date.now());

	// Clean up old entries
	for (const [term, time] of activeJobs.entries()) {
		if (Date.now() - time > config.rateLimit.scraper.cacheCleanupInterval) {
			activeJobs.delete(term);
		}
	}

	return true;
}
