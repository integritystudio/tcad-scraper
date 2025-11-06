"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scraperQueue = void 0;
exports.canScheduleJob = canScheduleJob;
const bull_1 = __importDefault(require("bull"));
const tcad_scraper_1 = require("../lib/tcad-scraper");
const winston_1 = __importDefault(require("winston"));
const prisma_1 = require("../lib/prisma");
const config_1 = require("../config");
const logger = winston_1.default.createLogger({
    level: config_1.config.logging.level,
    format: winston_1.default.format.json(),
    transports: [
        new winston_1.default.transports.Console({
            format: winston_1.default.format.simple(),
        }),
    ],
});
// Create the Bull queue
exports.scraperQueue = new bull_1.default(config_1.config.queue.name, {
    redis: {
        host: config_1.config.redis.host,
        port: config_1.config.redis.port,
        password: config_1.config.redis.password,
        db: config_1.config.redis.db,
    },
    defaultJobOptions: {
        attempts: config_1.config.queue.defaultJobOptions.attempts,
        backoff: {
            type: 'exponential',
            delay: config_1.config.queue.defaultJobOptions.backoffDelay,
        },
        removeOnComplete: config_1.config.queue.defaultJobOptions.removeOnComplete,
        removeOnFail: config_1.config.queue.defaultJobOptions.removeOnFail,
    },
});
// Process scraping jobs
exports.scraperQueue.process(config_1.config.queue.jobName, config_1.config.queue.concurrency, async (job) => {
    const startTime = Date.now();
    const { searchTerm, userId, scheduled = false } = job.data;
    logger.info(`Processing scrape job ${job.id} for search term: ${searchTerm}`);
    // Create a job record in the database
    const scrapeJob = await prisma_1.prisma.scrapeJob.create({
        data: {
            searchTerm,
            status: 'processing',
        },
    });
    const scraper = new tcad_scraper_1.TCADScraper({
        headless: config_1.config.env.isProduction ? true : config_1.config.scraper.headless,
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
                const valuesClauses = [];
                const params = [];
                let paramIndex = 1;
                for (const property of chunk) {
                    valuesClauses.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, ` +
                        `$${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, ` +
                        `$${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11}, $${paramIndex + 12})`);
                    params.push(property.propertyId, property.name, property.propType, property.city, property.propertyAddress, property.assessedValue, property.appraisedValue, property.geoId, property.description, searchTerm, now, now, now);
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
                await prisma_1.prisma.$executeRawUnsafe(sql, ...params);
                savedCount += chunk.length;
                logger.info(`Batch upserted ${chunk.length} properties (${savedCount}/${properties.length} total)`);
            }
        }
        const savedProperties = properties;
        // Update progress: Complete
        await job.progress(100);
        // Update job record
        await prisma_1.prisma.scrapeJob.update({
            where: { id: scrapeJob.id },
            data: {
                status: 'completed',
                resultCount: savedProperties.length,
                completedAt: new Date(),
            },
        });
        const duration = Date.now() - startTime;
        const result = {
            count: savedProperties.length,
            properties: savedProperties,
            searchTerm,
            duration,
        };
        logger.info(`Job ${job.id} completed successfully. Found ${result.count} properties in ${duration}ms`);
        return result;
    }
    catch (error) {
        logger.error(`Job ${job.id} failed:`, error);
        // Update job record with error
        await prisma_1.prisma.scrapeJob.update({
            where: { id: scrapeJob.id },
            data: {
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
                completedAt: new Date(),
            },
        });
        throw error;
    }
    finally {
        await scraper.cleanup();
    }
});
// Event listeners for queue monitoring
exports.scraperQueue.on('completed', (job, result) => {
    logger.info(`Job ${job.id} completed with ${result.count} properties in ${result.duration}ms`);
});
exports.scraperQueue.on('failed', (job, err) => {
    logger.error(`Job ${job.id} failed after ${job.attemptsMade} attempts:`, err);
});
exports.scraperQueue.on('stalled', (job) => {
    logger.warn(`Job ${job.id} stalled and will be retried`);
});
// Clean up old jobs periodically
setInterval(async () => {
    try {
        await exports.scraperQueue.clean(config_1.config.queue.cleanupGracePeriod, 'completed');
        await exports.scraperQueue.clean(config_1.config.queue.cleanupGracePeriod, 'failed');
        logger.info('Cleaned old jobs from queue');
    }
    catch (error) {
        logger.error('Failed to clean queue:', error);
    }
}, config_1.config.queue.cleanupInterval);
// Rate limiting helper
const activeJobs = new Map();
async function canScheduleJob(searchTerm) {
    const lastJobTime = activeJobs.get(searchTerm);
    if (lastJobTime && Date.now() - lastJobTime < config_1.config.rateLimit.scraper.jobDelay) {
        return false;
    }
    activeJobs.set(searchTerm, Date.now());
    // Clean up old entries
    for (const [term, time] of activeJobs.entries()) {
        if (Date.now() - time > config_1.config.rateLimit.scraper.cacheCleanupInterval) {
            activeJobs.delete(term);
        }
    }
    return true;
}
//# sourceMappingURL=scraper.queue.js.map