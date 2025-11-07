import { scraperQueue } from '../queues/scraper.queue';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

async function enqueuePriorityTerms() {
  const priorityTerms = ['Real', 'Estate', 'Trust', 'Part', 'Hill'];

  logger.info('╔══════════════════════════════════════════════════════════╗');
  logger.info('║   Enqueuing Priority Search Terms                      ║');
  logger.info('╚══════════════════════════════════════════════════════════╝');
  logger.info('');
  logger.info(`Adding ${priorityTerms.length} high-priority search terms to the front of the queue...`);
  logger.info('');

  let successCount = 0;

  for (const searchTerm of priorityTerms) {
    try {
      // Add to queue with high priority (priority: 1 = highest)
      // Lower priority numbers are processed first
      const job = await scraperQueue.add(
        'scrape-properties',
        {
          searchTerm,
          userId: 'priority-batch',
          scheduled: false,
        },
        {
          priority: 1, // Highest priority - will be processed first
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: 50,
        }
      );

      successCount++;
      logger.info(`✓ Added "${searchTerm}" to queue with priority 1 (job ID: ${job.id})`);
    } catch (error) {
      logger.error(`✗ Failed to enqueue "${searchTerm}":`, error);
    }
  }

  logger.info('');
  logger.info('─────────────────────────────────────────────────────────');
  logger.info(`✅ Successfully added ${successCount}/${priorityTerms.length} priority terms to the queue`);
  logger.info('');
  logger.info('These jobs will be processed before other pending jobs.');
  logger.info('Monitor at: http://localhost:5050/admin/queues');
  logger.info('');

  // Show queue status
  const [waiting, active] = await Promise.all([
    scraperQueue.getWaitingCount(),
    scraperQueue.getActiveCount(),
  ]);

  logger.info('Current Queue Status:');
  logger.info(`  • Waiting: ${waiting}`);
  logger.info(`  • Active:  ${active}`);
  logger.info('');

  await scraperQueue.close();
  process.exit(0);
}

enqueuePriorityTerms().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
