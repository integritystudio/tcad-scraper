import Bull from 'bull';
import { TCADScraper } from '../lib/tcad-scraper';
import { ScrapeJobData, ScrapeJobResult } from '../types';
import winston from 'winston';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { cacheService } from '../lib/redis-cache.service';
import { searchTermOptimizer } from '../services/search-term-optimizer';

const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Create the Bull queue
export const scraperQueue = new Bull<ScrapeJobData>(config.queue.name, {
  redis: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db,
  },
  defaultJobOptions: {
    attempts: config.queue.defaultJobOptions.attempts,
    backoff: {
      type: 'exponential',
      delay: config.queue.defaultJobOptions.backoffDelay,
    },
    removeOnComplete: config.queue.defaultJobOptions.removeOnComplete,
    removeOnFail: config.queue.defaultJobOptions.removeOnFail,
  },
});

// Process scraping jobs
scraperQueue.process(config.queue.jobName, config.queue.concurrency, async (job) => {
  const startTime = Date.now();
  const { searchTerm } = job.data;

  logger.info(`Processing scrape job ${job.id} for search term: ${searchTerm}`);

  // Create a job record in the database
  const scrapeJob = await prisma.scrapeJob.create({
    data: {
      searchTerm,
      status: 'processing',
    },
  });

  const scraper = new TCADScraper({
    headless: config.env.isProduction ? true : config.scraper.headless,
  });

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
      // Process in chunks of 500 to avoid query size limits
      const CHUNK_SIZE = 500;

      for (let i = 0; i < properties.length; i += CHUNK_SIZE) {
        const chunk = properties.slice(i, i + CHUNK_SIZE);

        // Build the VALUES clause dynamically
        const now = new Date();
        const valuesClauses: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        for (const property of chunk) {
          valuesClauses.push(
            `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, ` +
            `$${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, ` +
            `$${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11}, $${paramIndex + 12})`
          );

          params.push(
            property.propertyId,
            property.name,
            property.propType,
            property.city,
            property.propertyAddress,
            property.assessedValue,
            property.appraisedValue,
            property.geoId,
            property.description,
            searchTerm,
            now,
            now,
            now
          );

          paramIndex += 13;
        }

        // Execute raw SQL with PostgreSQL's native UPSERT (ON CONFLICT)
        const sql = `
          INSERT INTO properties (
            property_id, name, prop_type, city, property_address,
            assessed_value, appraised_value, geo_id, description,
            search_term, scraped_at, created_at, updated_at
          )
          VALUES ${valuesClauses.join(', ')}
          ON CONFLICT (property_id) DO UPDATE SET
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
        `;

        await prisma.$executeRawUnsafe(sql, ...params);

        savedCount += chunk.length;
        logger.info(`Batch upserted ${chunk.length} properties (${savedCount}/${properties.length} total)`);
      }
    }

    const savedProperties = properties;

    // Update progress: Complete
    await job.progress(100);

    // Update job record
    await prisma.scrapeJob.update({
      where: { id: scrapeJob.id },
      data: {
        status: 'completed',
        resultCount: savedProperties.length,
        completedAt: new Date(),
      },
    });

    // Update search term analytics for optimization
    await searchTermOptimizer.updateAnalytics(
      searchTerm,
      savedProperties.length,
      true // wasSuccessful
    );

    // Invalidate caches since new properties were added
    logger.info('Invalidating caches after successful scrape...');
    await Promise.all([
      cacheService.deletePattern('properties:list:*'),  // Invalidate all list queries
      cacheService.delete('properties:stats:all'),      // Invalidate statistics
    ]);
    logger.info('Caches invalidated successfully');

    const duration = Date.now() - startTime;
    const result: ScrapeJobResult = {
      count: savedProperties.length,
      properties: savedProperties,
      searchTerm,
      duration,
    };

    logger.info(`Job ${job.id} completed successfully. Found ${result.count} properties in ${duration}ms`);

    return result;

  } catch (error) {
    logger.error(`Job ${job.id} failed:`, error);

    // Update job record with error
    await prisma.scrapeJob.update({
      where: { id: scrapeJob.id },
      data: {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      },
    });

    // Update search term analytics for failed job
    await searchTermOptimizer.updateAnalytics(
      searchTerm,
      0, // resultCount
      false, // wasSuccessful
      error instanceof Error ? error.message : 'Unknown error'
    );

    throw error;

  } finally {
    await scraper.cleanup();
  }
});

// Event listeners for queue monitoring
scraperQueue.on('completed', (job, result: ScrapeJobResult) => {
  logger.info(`Job ${job.id} completed with ${result.count} properties in ${result.duration}ms`);
});

scraperQueue.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed after ${job.attemptsMade} attempts:`, err);
});

scraperQueue.on('stalled', (job) => {
  logger.warn(`Job ${job.id} stalled and will be retried`);
});

// Clean up old jobs periodically
setInterval(async () => {
  try {
    await scraperQueue.clean(config.queue.cleanupGracePeriod, 'completed');
    await scraperQueue.clean(config.queue.cleanupGracePeriod, 'failed');
    logger.info('Cleaned old jobs from queue');
  } catch (error) {
    logger.error('Failed to clean queue:', error);
  }
}, config.queue.cleanupInterval);

// Rate limiting helper
const activeJobs = new Map<string, number>();

export async function canScheduleJob(searchTerm: string): Promise<boolean> {
  const lastJobTime = activeJobs.get(searchTerm);

  if (lastJobTime && Date.now() - lastJobTime < config.rateLimit.scraper.jobDelay) {
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