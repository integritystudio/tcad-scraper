import cron from 'node-cron';
import { scraperQueue } from '../queues/scraper.queue';
import { prisma } from '../lib/prisma';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

class ScheduledJobs {
  private tasks: cron.ScheduledTask[] = [];

  initialize() {
    logger.info('Initializing scheduled jobs...');

    // Daily scrape at 2 AM for monitored searches
    const dailyTask = cron.schedule('0 2 * * *', async () => {
      await this.runScheduledScrapes('daily');
    }, {
      scheduled: false,
      timezone: 'America/Chicago',
    });

    // Weekly scrape on Sundays at 3 AM
    const weeklyTask = cron.schedule('0 3 * * 0', async () => {
      await this.runScheduledScrapes('weekly');
    }, {
      scheduled: false,
      timezone: 'America/Chicago',
    });

    // Monthly scrape on the 1st at 4 AM
    const monthlyTask = cron.schedule('0 4 1 * *', async () => {
      await this.runScheduledScrapes('monthly');
    }, {
      scheduled: false,
      timezone: 'America/Chicago',
    });

    // Clean up old jobs every hour
    const cleanupTask = cron.schedule('0 * * * *', async () => {
      await this.cleanupOldJobs();
    }, {
      scheduled: false,
    });

    this.tasks = [dailyTask, weeklyTask, monthlyTask, cleanupTask];

    // Start all tasks
    this.tasks.forEach(task => task.start());

    logger.info('Scheduled jobs initialized successfully');
  }

  private async runScheduledScrapes(frequency: string) {
    try {
      logger.info(`Running ${frequency} scheduled scrapes...`);

      const monitoredSearches = await prisma.monitoredSearch.findMany({
        where: {
          active: true,
          frequency,
        },
      });

      logger.info(`Found ${monitoredSearches.length} ${frequency} searches to run`);

      for (const search of monitoredSearches) {
        // Add random delay to avoid overwhelming the target site
        const delay = Math.floor(Math.random() * 60000); // 0-60 seconds

        await scraperQueue.add(
          'scrape-properties',
          {
            searchTerm: search.searchTerm,
            scheduled: true,
          },
          {
            delay,
            attempts: 5,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
          }
        );

        // Update last run time
        await prisma.monitoredSearch.update({
          where: { id: search.id },
          data: { lastRun: new Date() },
        });

        logger.info(`Scheduled scrape for "${search.searchTerm}" with ${delay}ms delay`);
      }
    } catch (error) {
      logger.error(`Failed to run ${frequency} scheduled scrapes:`, error);
    }
  }

  private async cleanupOldJobs() {
    try {
      logger.info('Cleaning up old jobs...');

      // Delete scrape jobs older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const deletedJobs = await prisma.scrapeJob.deleteMany({
        where: {
          completedAt: {
            lt: thirtyDaysAgo,
          },
        },
      });

      // Clean Bull queue completed/failed jobs older than 7 days
      const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
      await scraperQueue.clean(sevenDaysInMs, 'completed');
      await scraperQueue.clean(sevenDaysInMs, 'failed');

      logger.info(`Cleaned up ${deletedJobs.count} old database jobs`);
    } catch (error) {
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

export const scheduledJobs = new ScheduledJobs();