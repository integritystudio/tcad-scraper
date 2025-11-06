import Bull from 'bull';
import { TCADScraper } from '../lib/tcad-scraper';
import { ScrapeJobData, ScrapeJobResult } from '../types';
import winston from 'winston';
import { prisma } from '../lib/prisma';
import { config } from '../config';

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
  const { searchTerm, userId, scheduled = false } = job.data;

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

    // Bulk upsert properties to database
    const savedProperties = await Promise.all(
      properties.map(async (property) => {
        return await prisma.property.upsert({
          where: { propertyId: property.propertyId },
          update: {
            name: property.name,
            propType: property.propType,
            city: property.city,
            propertyAddress: property.propertyAddress,
            assessedValue: property.assessedValue,
            appraisedValue: property.appraisedValue,
            geoId: property.geoId,
            description: property.description,
            searchTerm,
            scrapedAt: new Date(),
          },
          create: {
            propertyId: property.propertyId,
            name: property.name,
            propType: property.propType,
            city: property.city,
            propertyAddress: property.propertyAddress,
            assessedValue: property.assessedValue,
            appraisedValue: property.appraisedValue,
            geoId: property.geoId,
            description: property.description,
            searchTerm,
          },
        });
      })
    );

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