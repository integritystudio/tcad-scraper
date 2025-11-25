"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const scraper_queue_1 = require("../queues/scraper.queue");
const winston_1 = __importDefault(require("winston"));
const logger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.simple()),
    transports: [
        new winston_1.default.transports.Console(),
    ],
});
// 100 diverse search terms for maximum property coverage
const SEARCH_TERMS = [
    // More Austin streets (30)
    'South Lamar', 'East Riverside', 'West Anderson', 'South Congress',
    'East 6th', 'West 6th', 'Manchaca', 'Mopac', 'Red River',
    'Rainey', 'Cesar Chavez', 'MLK', 'Dean Keeton', 'Speedway',
    'Duval', 'Shoal Creek', 'Koenig', 'Far West', 'Research Blvd',
    'South First', 'East 7th', 'West 12th', 'Barton Springs',
    'Westlake', 'Exposition', 'Windsor', 'Enfield', 'Balcones',
    'Spicewood', 'Capital of Texas',
    // Common last names (30)
    'Smith', 'Johnson', 'Williams', 'Jones', 'Brown',
    'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor',
    'Anderson', 'Thomas', 'Jackson', 'White', 'Harris',
    'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson',
    'Clark', 'Rodriguez', 'Lewis', 'Lee', 'Walker',
    'Hall', 'Allen', 'Young', 'King', 'Wright',
    // Austin neighborhoods (20)
    'Hyde Park', 'Tarrytown', 'Clarksville', 'Bouldin Creek',
    'South Austin', 'North Austin', 'East Austin', 'West Austin',
    'Rosedale', 'Crestview', 'Mueller', 'Domain', 'Downtown',
    'Zilker', 'Barton Hills', 'Travis Heights', 'Allandale',
    'Brentwood', 'Dawson', 'Cherrywood',
    // Business/building types (10)
    'Plaza', 'Center', 'Tower', 'Building', 'Office',
    'Apartments', 'Condos', 'Ranch', 'Estates', 'Village',
    // Additional streets (10)
    'Cameron', 'Metric', 'Dessau', 'Lamar Blvd', 'IH 35',
    'Loop 360', 'Wells Branch', 'McNeil', 'Howard', 'Jollyville',
];
async function queueBatch() {
    logger.info('╔════════════════════════════════════════════════════════╗');
    logger.info('║   QUEUEING 100 NEW SCRAPING JOBS                       ║');
    logger.info('╚════════════════════════════════════════════════════════╝\n');
    logger.info(`Total search terms: ${SEARCH_TERMS.length}\n`);
    let queued = 0;
    let failed = 0;
    for (const searchTerm of SEARCH_TERMS) {
        try {
            const job = await scraper_queue_1.scraperQueue.add('scrape-properties', {
                searchTerm,
                userId: 'batch-100',
                scheduled: true,
            }, {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
                removeOnComplete: 100,
                removeOnFail: 50,
            });
            queued++;
            logger.info(`  ✓ [${queued}/${SEARCH_TERMS.length}] ${searchTerm} (Job ${job.id})`);
            // Small delay to avoid overwhelming Redis
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        catch (error) {
            failed++;
            logger.error(`  ✗ ${searchTerm}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    logger.info(`\n✅ Successfully queued ${queued} jobs`);
    if (failed > 0) {
        logger.warn(`⚠️  Failed to queue ${failed} jobs`);
    }
    // Get queue stats
    const [waiting, active] = await Promise.all([
        scraper_queue_1.scraperQueue.getWaitingCount(),
        scraper_queue_1.scraperQueue.getActiveCount(),
    ]);
    logger.info(`\nCurrent queue status:`);
    logger.info(`  ⏳ Waiting: ${waiting}`);
    logger.info(`  🔄 Active: ${active}`);
    logger.info(`\nEstimated completion time: ~${Math.ceil((waiting + active) * 30 / 60)} minutes`);
    process.exit(0);
}
queueBatch().catch((error) => {
    logger.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
//# sourceMappingURL=batch-scrape-100.js.map