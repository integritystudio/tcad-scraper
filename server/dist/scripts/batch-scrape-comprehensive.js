"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const scraper_queue_1 = require("../queues/scraper.queue");
const prisma_1 = require("../lib/prisma");
const winston_1 = __importDefault(require("winston"));
const logger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.simple()),
    transports: [
        new winston_1.default.transports.Console(),
    ],
});
// ALL Travis County ZIP codes
const ALL_ZIP_CODES = [
    '78701', '78702', '78703', '78704', '78705', '78712', '78719',
    '78721', '78722', '78723', '78724', '78725', '78726', '78727',
    '78728', '78729', '78730', '78731', '78732', '78733', '78734',
    '78735', '78736', '78737', '78738', '78739', '78741', '78742',
    '78744', '78745', '78746', '78747', '78748', '78749', '78750',
    '78751', '78752', '78753', '78754', '78756', '78757', '78758',
    '78759', '78760', '78761', '78762', '78763', '78764', '78765',
    '78766', '78767', '78768', '78769', '78772', '78773', '78774',
    '78778', '78779', '78780', '78781', '78783', '78799',
];
// Travis County cities
const CITIES = [
    'Austin',
    'Round Rock',
    'Pflugerville',
    'Cedar Park',
    'Leander',
    'Georgetown',
    'Manor',
    'Lakeway',
    'Bee Cave',
    'West Lake Hills',
    'Rollingwood',
    'Sunset Valley',
    'Jonestown',
    'Creedmoor',
    'Elgin',
    'Hutto',
    'San Marcos',
];
// Common last name patterns for broad coverage
const ALPHABET_PATTERNS = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
];
// Two-letter combinations for more coverage (common name prefixes)
const COMMON_NAME_PREFIXES = [
    'Mc', 'Mac', 'Van', 'De', 'La', 'Le', 'St', 'San', 'Del',
    'Al', 'El', 'Di', 'Da', 'Du', 'Mc', 'O\'',
];
// Common street names in Austin/Travis County
const COMMON_STREETS = [
    'Main', 'Oak', 'Park', 'Cedar', 'Elm', 'Lake', 'Hill', 'River',
    'Congress', 'Lamar', 'Guadalupe', 'Burnet', 'Airport', 'Oltorf',
    'Anderson', 'Bee Cave', 'Slaughter', 'William Cannon',
    'Research', 'Parmer', 'Braker', 'Rundberg', 'North Loop',
];
// Numeric patterns (property IDs often searchable)
const NUMERIC_PATTERNS = [
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
    '10', '100', '1000', '2000', '3000', '5000',
];
class ComprehensiveBatchScraper {
    config;
    stats = {
        totalQueued: 0,
        totalCompleted: 0,
        totalFailed: 0,
        startTime: Date.now(),
    };
    constructor(config = {}) {
        this.config = {
            includeZipCodes: false, // ZIP codes don't work on TCAD website
            includeCities: true,
            includeAlphabet: true,
            includeNamePrefixes: true,
            includeStreets: true,
            includeNumeric: true,
            batchSize: 20,
            delayBetweenBatches: 3000,
            ...config,
        };
    }
    getSearchTerms() {
        const terms = [];
        if (this.config.includeZipCodes) {
            terms.push(...ALL_ZIP_CODES);
            logger.info(`✓ Added ${ALL_ZIP_CODES.length} ZIP codes`);
        }
        if (this.config.includeCities) {
            terms.push(...CITIES);
            logger.info(`✓ Added ${CITIES.length} cities`);
        }
        if (this.config.includeAlphabet) {
            terms.push(...ALPHABET_PATTERNS);
            logger.info(`✓ Added ${ALPHABET_PATTERNS.length} alphabet patterns`);
        }
        if (this.config.includeNamePrefixes) {
            terms.push(...COMMON_NAME_PREFIXES);
            logger.info(`✓ Added ${COMMON_NAME_PREFIXES.length} name prefixes`);
        }
        if (this.config.includeStreets) {
            terms.push(...COMMON_STREETS);
            logger.info(`✓ Added ${COMMON_STREETS.length} street names`);
        }
        if (this.config.includeNumeric) {
            terms.push(...NUMERIC_PATTERNS);
            logger.info(`✓ Added ${NUMERIC_PATTERNS.length} numeric patterns`);
        }
        // Filter out search terms with less than 4 characters (TCAD minimum)
        const filteredTerms = terms.filter(term => term.length >= 4);
        const removedCount = terms.length - filteredTerms.length;
        if (removedCount > 0) {
            logger.info(`✗ Filtered out ${removedCount} terms shorter than 4 characters`);
        }
        return filteredTerms;
    }
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async queueJobs() {
        const searchTerms = this.getSearchTerms();
        logger.info('\n╔════════════════════════════════════════════════════════╗');
        logger.info('║   COMPREHENSIVE TCAD DATABASE SCRAPING                 ║');
        logger.info('╚════════════════════════════════════════════════════════╝\n');
        logger.info(`Total search terms: ${searchTerms.length}`);
        logger.info(`Batch size: ${this.config.batchSize}`);
        logger.info(`Delay between batches: ${this.config.delayBetweenBatches}ms\n`);
        // Process in batches
        for (let i = 0; i < searchTerms.length; i += this.config.batchSize) {
            const batch = searchTerms.slice(i, i + this.config.batchSize);
            const batchNum = Math.floor(i / this.config.batchSize) + 1;
            const totalBatches = Math.ceil(searchTerms.length / this.config.batchSize);
            logger.info(`\n📦 Batch ${batchNum}/${totalBatches} (${batch.length} terms)`);
            for (const searchTerm of batch) {
                try {
                    const job = await scraper_queue_1.scraperQueue.add('scrape-properties', {
                        searchTerm,
                        userId: 'comprehensive-batch',
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
                    this.stats.totalQueued++;
                    logger.info(`  ✓ ${searchTerm} (Job ${job.id})`);
                }
                catch (error) {
                    logger.error(`  ✗ ${searchTerm}:`, error);
                }
            }
            // Delay between batches
            if (i + this.config.batchSize < searchTerms.length) {
                const remaining = searchTerms.length - (i + this.config.batchSize);
                logger.info(`\n⏳ Waiting ${this.config.delayBetweenBatches}ms... (${remaining} terms remaining)`);
                await this.delay(this.config.delayBetweenBatches);
            }
        }
        logger.info(`\n✅ All ${this.stats.totalQueued} jobs queued successfully!`);
    }
    async monitorProgress() {
        logger.info('\n╔════════════════════════════════════════════════════════╗');
        logger.info('║          MONITORING PROGRESS                           ║');
        logger.info('╚════════════════════════════════════════════════════════╝\n');
        const checkInterval = 30000; // Check every 30 seconds
        while (true) {
            await this.delay(checkInterval);
            // Get queue stats
            const [waiting, active, completed, failed] = await Promise.all([
                scraper_queue_1.scraperQueue.getWaitingCount(),
                scraper_queue_1.scraperQueue.getActiveCount(),
                scraper_queue_1.scraperQueue.getCompletedCount(),
                scraper_queue_1.scraperQueue.getFailedCount(),
            ]);
            const elapsed = Math.floor((Date.now() - this.stats.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            // Get database stats
            const totalProperties = await prisma_1.prisma.property.count();
            const recentProperties = await prisma_1.prisma.property.count({
                where: {
                    scrapedAt: {
                        gte: new Date(Date.now() - 300000), // Last 5 minutes
                    },
                },
            });
            const progress = ((completed + failed) / this.stats.totalQueued) * 100;
            logger.info(`
┌─────────────────────────────────────────────────────────┐
│ Time: ${minutes}m ${seconds}s | Progress: ${progress.toFixed(1)}%
├─────────────────────────────────────────────────────────┤
│ Queue Status:
│   ⏳ Waiting:   ${waiting.toString().padStart(6)}
│   🔄 Active:    ${active.toString().padStart(6)}
│   ✅ Completed: ${completed.toString().padStart(6)}
│   ❌ Failed:    ${failed.toString().padStart(6)}
│   📊 Total:     ${this.stats.totalQueued.toString().padStart(6)}
├─────────────────────────────────────────────────────────┤
│ Database:
│   📝 Total Properties:  ${totalProperties.toString().padStart(8)}
│   🆕 Last 5 min:        ${recentProperties.toString().padStart(8)}
│   ⚡ Rate: ${(recentProperties / 5).toFixed(1)} properties/min
└─────────────────────────────────────────────────────────┘
      `);
            // Check if all jobs are done
            if (waiting === 0 && active === 0 && completed + failed >= this.stats.totalQueued) {
                logger.info('\n✅ All jobs completed!');
                break;
            }
        }
        await this.printFinalReport();
    }
    async printFinalReport() {
        const [totalProperties, uniqueCount, totalJobs, successfulJobs] = await Promise.all([
            prisma_1.prisma.property.count(),
            prisma_1.prisma.property.findMany({ select: { propertyId: true }, distinct: ['propertyId'] }),
            prisma_1.prisma.scrapeJob.count(),
            prisma_1.prisma.scrapeJob.count({ where: { status: 'completed' } }),
        ]);
        const elapsed = Math.floor((Date.now() - this.stats.startTime) / 1000);
        const hours = Math.floor(elapsed / 3600);
        const minutes = Math.floor((elapsed % 3600) / 60);
        const seconds = elapsed % 60;
        const completed = await scraper_queue_1.scraperQueue.getCompletedCount();
        const failed = await scraper_queue_1.scraperQueue.getFailedCount();
        logger.info(`
╔══════════════════════════════════════════════════════════╗
║         COMPREHENSIVE SCRAPING FINAL REPORT               ║
╚══════════════════════════════════════════════════════════╝

⏱️  Time Elapsed: ${hours}h ${minutes}m ${seconds}s

📊 Jobs:
   • Total Queued:    ${this.stats.totalQueued}
   • Completed:       ${completed}
   • Failed:          ${failed}
   • Success Rate:    ${((completed / this.stats.totalQueued) * 100).toFixed(2)}%

💾 Database:
   • Total Properties:     ${totalProperties}
   • Unique Properties:    ${uniqueCount.length}
   • Duplicate Entries:    ${totalProperties - uniqueCount.length}
   • Total Scrape Jobs:    ${totalJobs}
   • Successful Jobs:      ${successfulJobs}
   • Overall Success Rate: ${((successfulJobs / totalJobs) * 100).toFixed(2)}%

⚡ Performance:
   • Avg Time per Job:      ${(elapsed / completed).toFixed(2)}s
   • Properties per Hour:   ${((totalProperties / elapsed) * 3600).toFixed(0)}
   • Jobs per Hour:         ${((completed / elapsed) * 3600).toFixed(0)}

Coverage Strategy:
   ✓ All ZIP codes (${ALL_ZIP_CODES.length})
   ✓ Cities (${CITIES.length})
   ✓ Alphabet patterns (${ALPHABET_PATTERNS.length})
   ✓ Name prefixes (${COMMON_NAME_PREFIXES.length})
   ✓ Street names (${COMMON_STREETS.length})
   ✓ Numeric patterns (${NUMERIC_PATTERNS.length})

╔══════════════════════════════════════════════════════════╗
║  🎉 COMPREHENSIVE SCRAPING COMPLETED SUCCESSFULLY! 🎉     ║
╚══════════════════════════════════════════════════════════╝
    `);
    }
    async run() {
        try {
            await this.queueJobs();
            await this.monitorProgress();
            process.exit(0);
        }
        catch (error) {
            logger.error('❌ Fatal error:', error);
            process.exit(1);
        }
    }
}
// Run the scraper
const scraper = new ComprehensiveBatchScraper({
    includeZipCodes: false, // ZIP codes don't work on TCAD website
    includeCities: true,
    includeAlphabet: false, // Single letters likely won't return meaningful results
    includeNamePrefixes: false, // Short name prefixes filtered out by 4-char minimum
    includeStreets: true, // Streets work well!
    includeNumeric: false, // Numbers likely won't return useful results
    batchSize: 10, // Reduce batch size to avoid overwhelming the server
    delayBetweenBatches: 3000, // Increase delay to be more respectful
});
scraper.run();
//# sourceMappingURL=batch-scrape-comprehensive.js.map