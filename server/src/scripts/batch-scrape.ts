import { scraperQueue } from '../queues/scraper.queue';
import { prisma } from '../lib/prisma';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Travis County cities and major areas
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

// Travis County ZIP codes (major ones)
const ZIP_CODES = [
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

// Property types commonly found in TCAD
const PROPERTY_TYPES = [
  'A', // Single Family Residential
  'B', // Multi-Family Residential
  'C', // Vacant Lots/Land
  'D', // Rural Real (Land)
  'E', // Farm & Ranch
  'F', // Commercial Real
  'G', // Oil, Gas, Minerals
  'H', // Industrial Real
  'J', // Water Systems
  'L', // Miscellaneous
  'M', // Mobile Homes
  'N', // Intangible Personal Property
  'O', // Residential Inventory
  'P', // Non-Residential Inventory
  'S', // Special Inventory
  'X', // Totally Exempt Property
];

// Street name prefixes for comprehensive coverage (kept for future use)
// @ts-expect-error - Intentionally unused constant kept for future use
const _STREET_PREFIXES = [
  'North', 'South', 'East', 'West',
  'N', 'S', 'E', 'W',
];

// Common street suffixes (kept for future use)
// @ts-expect-error - Intentionally unused constant kept for future use
const _STREET_SUFFIXES = [
  'Street', 'St', 'Avenue', 'Ave', 'Road', 'Rd', 'Drive', 'Dr',
  'Lane', 'Ln', 'Court', 'Ct', 'Circle', 'Cir', 'Boulevard', 'Blvd',
  'Way', 'Trail', 'Path', 'Place', 'Pl',
];

interface BatchConfig {
  batchSize: number;
  delayBetweenBatches: number; // milliseconds
  maxConcurrentJobs: number;
  searchStrategy: 'cities' | 'zipcodes' | 'types' | 'comprehensive' | 'custom';
  customSearchTerms?: string[];
}

class BatchScraper {
  private config: BatchConfig;
  private jobIds: string[] = [];
  private stats = {
    totalQueued: 0,
    totalCompleted: 0,
    totalFailed: 0,
    startTime: Date.now(),
  };

  constructor(config: Partial<BatchConfig> = {}) {
    this.config = {
      batchSize: 10,
      delayBetweenBatches: 5000,
      maxConcurrentJobs: 3,
      searchStrategy: 'comprehensive',
      ...config,
    };
  }

  private getSearchTerms(): string[] {
    let terms: string[];
    switch (this.config.searchStrategy) {
      case 'cities':
        terms = CITIES;
        break;
      case 'zipcodes':
        terms = ZIP_CODES;
        break;
      case 'types':
        terms = PROPERTY_TYPES;
        break;
      case 'custom':
        terms = this.config.customSearchTerms || [];
        break;
      case 'comprehensive':
      default:
        // Combine multiple strategies for maximum coverage
        terms = [
          ...CITIES,
          ...ZIP_CODES.slice(0, 20), // Use first 20 ZIP codes
          ...PROPERTY_TYPES,
        ];
    }

    // Filter out search terms with less than 4 characters (TCAD minimum)
    return terms.filter(term => term.length >= 4);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async queueJobs(): Promise<void> {
    const searchTerms = this.getSearchTerms();
    logger.info(`Starting batch scrape with ${searchTerms.length} search terms using strategy: ${this.config.searchStrategy}`);
    logger.info(`Batch size: ${this.config.batchSize}, Delay: ${this.config.delayBetweenBatches}ms`);

    // Process in batches
    for (let i = 0; i < searchTerms.length; i += this.config.batchSize) {
      const batch = searchTerms.slice(i, i + this.config.batchSize);
      logger.info(`\nQueuing batch ${Math.floor(i / this.config.batchSize) + 1}/${Math.ceil(searchTerms.length / this.config.batchSize)}`);

      for (const searchTerm of batch) {
        try {
          const job = await scraperQueue.add(
            'scrape-properties',
            {
              searchTerm,
              userId: 'batch-scraper',
              scheduled: true,
            },
            {
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 2000,
              },
              removeOnComplete: 100,
              removeOnFail: 50,
            }
          );

          this.jobIds.push(job.id.toString());
          this.stats.totalQueued++;
          logger.info(`  ✓ Queued: ${searchTerm} (Job ID: ${job.id})`);
        } catch (error) {
          logger.error(`  ✗ Failed to queue: ${searchTerm}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Delay between batches to avoid overwhelming the system
      if (i + this.config.batchSize < searchTerms.length) {
        logger.info(`Waiting ${this.config.delayBetweenBatches}ms before next batch...`);
        await this.delay(this.config.delayBetweenBatches);
      }
    }

    logger.info(`\n✓ All jobs queued! Total: ${this.stats.totalQueued}`);
  }

  async monitorProgress(): Promise<void> {
    logger.info('\n=== Monitoring Job Progress ===\n');

    const checkInterval = 10000; // Check every 10 seconds

    while (this.stats.totalCompleted + this.stats.totalFailed < this.stats.totalQueued) {
      await this.delay(checkInterval);

      // Get job counts from queue
      const [waiting, active, completed, failed] = await Promise.all([
        scraperQueue.getWaitingCount(),
        scraperQueue.getActiveCount(),
        scraperQueue.getCompletedCount(),
        scraperQueue.getFailedCount(),
      ]);

      const elapsed = Math.floor((Date.now() - this.stats.startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;

      logger.info(`
Status Update (${minutes}m ${seconds}s elapsed):
  Waiting: ${waiting}
  Active: ${active}
  Completed: ${completed}
  Failed: ${failed}
  Total: ${this.stats.totalQueued}
      `);

      // Check database stats
      const dbStats = await this.getDatabaseStats();
      logger.info(`
Database Stats:
  Total Properties: ${dbStats.totalProperties}
  Unique Properties: ${dbStats.uniqueProperties}
  Scrape Jobs: ${dbStats.totalJobs}
  Success Rate: ${dbStats.successRate}%
      `);

      // Update our stats
      this.stats.totalCompleted = completed;
      this.stats.totalFailed = failed;

      if (waiting === 0 && active === 0) {
        logger.info('\n✓ All jobs completed!');
        break;
      }
    }

    await this.printFinalReport();
  }

  async getDatabaseStats() {
    const [totalProperties, uniqueCount, totalJobs, successfulJobs] = await Promise.all([
      prisma.property.count(),
      prisma.property.findMany({ select: { propertyId: true }, distinct: ['propertyId'] }),
      prisma.scrapeJob.count(),
      prisma.scrapeJob.count({ where: { status: 'completed' } }),
    ]);

    return {
      totalProperties,
      uniqueProperties: uniqueCount.length,
      totalJobs,
      successfulJobs,
      successRate: totalJobs > 0 ? ((successfulJobs / totalJobs) * 100).toFixed(2) : '0',
    };
  }

  async printFinalReport(): Promise<void> {
    const dbStats = await this.getDatabaseStats();
    const elapsed = Math.floor((Date.now() - this.stats.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    logger.info(`
╔════════════════════════════════════════════════════════╗
║           BATCH SCRAPING FINAL REPORT                  ║
╚════════════════════════════════════════════════════════╝

Time Elapsed: ${minutes} minutes ${seconds} seconds

Jobs:
  • Total Queued: ${this.stats.totalQueued}
  • Completed: ${this.stats.totalCompleted}
  • Failed: ${this.stats.totalFailed}
  • Success Rate: ${((this.stats.totalCompleted / this.stats.totalQueued) * 100).toFixed(2)}%

Database:
  • Total Properties: ${dbStats.totalProperties}
  • Unique Properties: ${dbStats.uniqueProperties}
  • Deduplication Rate: ${(((dbStats.totalProperties - dbStats.uniqueProperties) / dbStats.totalProperties) * 100).toFixed(2)}%
  • Total Scrape Jobs: ${dbStats.totalJobs}
  • Overall Success Rate: ${dbStats.successRate}%

Performance:
  • Avg Time per Job: ${(elapsed / this.stats.totalCompleted).toFixed(2)}s
  • Properties per Minute: ${((dbStats.totalProperties / elapsed) * 60).toFixed(2)}

Strategy Used: ${this.config.searchStrategy}
    `);
  }

  async run(): Promise<void> {
    try {
      logger.info('╔════════════════════════════════════════════════════════╗');
      logger.info('║        TCAD BATCH SCRAPER - Starting...                ║');
      logger.info('╚════════════════════════════════════════════════════════╝\n');

      // Queue all jobs
      await this.queueJobs();

      // Monitor progress
      await this.monitorProgress();

      logger.info('\n✓ Batch scraping completed successfully!');
      process.exit(0);
    } catch (error) {
      logger.error(`Fatal error during batch scraping: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }
}

// CLI interface
const args = process.argv.slice(2);
const strategy = (args[0] as BatchConfig['searchStrategy']) || 'comprehensive';
const batchSize = parseInt(args[1]) || 10;
const delay = parseInt(args[2]) || 5000;

const scraper = new BatchScraper({
  searchStrategy: strategy,
  batchSize,
  delayBetweenBatches: delay,
  maxConcurrentJobs: 3,
});

scraper.run();
