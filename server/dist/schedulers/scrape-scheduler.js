"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledJobs = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const scraper_queue_1 = require("../queues/scraper.queue");
const prisma_1 = require("../lib/prisma");
const winston_1 = __importDefault(require("winston"));
const logger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.json(),
    transports: [
        new winston_1.default.transports.Console({
            format: winston_1.default.format.simple(),
        }),
    ],
});
class ScheduledJobs {
    tasks = [];
    initialize() {
        logger.info('Initializing scheduled jobs...');
        // Daily scrape at 2 AM for monitored searches
        const dailyTask = node_cron_1.default.schedule('0 2 * * *', async () => {
            await this.runScheduledScrapes('daily');
        }, {
            scheduled: false,
            timezone: 'America/Chicago',
        });
        // Weekly scrape on Sundays at 3 AM
        const weeklyTask = node_cron_1.default.schedule('0 3 * * 0', async () => {
            await this.runScheduledScrapes('weekly');
        }, {
            scheduled: false,
            timezone: 'America/Chicago',
        });
        // Monthly scrape on the 1st at 4 AM
        const monthlyTask = node_cron_1.default.schedule('0 4 1 * *', async () => {
            await this.runScheduledScrapes('monthly');
        }, {
            scheduled: false,
            timezone: 'America/Chicago',
        });
        // Clean up old jobs every hour
        const cleanupTask = node_cron_1.default.schedule('0 * * * *', async () => {
            await this.cleanupOldJobs();
        }, {
            scheduled: false,
        });
        this.tasks = [dailyTask, weeklyTask, monthlyTask, cleanupTask];
        // Start all tasks
        this.tasks.forEach(task => task.start());
        logger.info('Scheduled jobs initialized successfully');
    }
    async runScheduledScrapes(frequency) {
        try {
            logger.info(`Running ${frequency} scheduled scrapes...`);
            const monitoredSearches = await prisma_1.prisma.monitoredSearch.findMany({
                where: {
                    active: true,
                    frequency,
                },
            });
            logger.info(`Found ${monitoredSearches.length} ${frequency} searches to run`);
            for (const search of monitoredSearches) {
                // Add random delay to avoid overwhelming the target site
                const delay = Math.floor(Math.random() * 60000); // 0-60 seconds
                await scraper_queue_1.scraperQueue.add('scrape-properties', {
                    searchTerm: search.searchTerm,
                    scheduled: true,
                }, {
                    delay,
                    attempts: 5,
                    backoff: {
                        type: 'exponential',
                        delay: 5000,
                    },
                });
                // Update last run time
                await prisma_1.prisma.monitoredSearch.update({
                    where: { id: search.id },
                    data: { lastRun: new Date() },
                });
                logger.info(`Scheduled scrape for "${search.searchTerm}" with ${delay}ms delay`);
            }
        }
        catch (error) {
            logger.error(`Failed to run ${frequency} scheduled scrapes:`, error);
        }
    }
    async cleanupOldJobs() {
        try {
            logger.info('Cleaning up old jobs...');
            // Delete scrape jobs older than 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const deletedJobs = await prisma_1.prisma.scrapeJob.deleteMany({
                where: {
                    completedAt: {
                        lt: thirtyDaysAgo,
                    },
                },
            });
            // Clean Bull queue completed/failed jobs older than 7 days
            const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
            await scraper_queue_1.scraperQueue.clean(sevenDaysInMs, 'completed');
            await scraper_queue_1.scraperQueue.clean(sevenDaysInMs, 'failed');
            logger.info(`Cleaned up ${deletedJobs.count} old database jobs`);
        }
        catch (error) {
            logger.error('Failed to clean up old jobs:', error);
        }
    }
    stop() {
        logger.info('Stopping scheduled jobs...');
        this.tasks.forEach(task => task.stop());
        logger.info('Scheduled jobs stopped');
    }
    // Manual trigger for testing
    async triggerDailyScrapes() {
        await this.runScheduledScrapes('daily');
    }
}
exports.scheduledJobs = new ScheduledJobs();
//# sourceMappingURL=scrape-scheduler.js.map