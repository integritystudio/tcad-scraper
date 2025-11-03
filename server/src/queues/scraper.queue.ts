import Bull from 'bull';
import { TCADScraper } from '../lib/tcad-scraper';
import { ScrapeJobData, ScrapeJobResult } from '../types';
import winston from 'winston';
import { prisma } from '../lib/prisma';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Create the Bull queue
export const scraperQueue = new Bull<ScrapeJobData>('scraper-queue', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50, // Keep last 50 failed jobs
  },
});

// Process scraping jobs
scraperQueue.process('scrape-properties', 2, async (job) => {
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
    headless: process.env.NODE_ENV === 'production',
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

// Clean up old jobs periodically (every hour)
setInterval(async () => {
  try {
    const grace = 1000 * 60 * 60 * 24; // 24 hours
    await scraperQueue.clean(grace, 'completed');
    await scraperQueue.clean(grace, 'failed');
    logger.info('Cleaned old jobs from queue');
  } catch (error) {
    logger.error('Failed to clean queue:', error);
  }
}, 60 * 60 * 1000);

// Rate limiting helper
const activeJobs = new Map<string, number>();

export async function canScheduleJob(searchTerm: string): Promise<boolean> {
  const lastJobTime = activeJobs.get(searchTerm);
  const rateLimitDelay = parseInt(process.env.SCRAPER_RATE_LIMIT_DELAY || '5000');

  if (lastJobTime && Date.now() - lastJobTime < rateLimitDelay) {
    return false;
  }

  activeJobs.set(searchTerm, Date.now());

  // Clean up old entries
  for (const [term, time] of activeJobs.entries()) {
    if (Date.now() - time > 60000) {
      activeJobs.delete(term);
    }
  }

  return true;
}