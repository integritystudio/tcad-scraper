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

logger.info('🚀 TCAD Scraper Worker started');
logger.info(`   Redis: ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`);
logger.info(`   Database: ${process.env.DATABASE_URL}`);
logger.info('\n👂 Listening for jobs...\n');

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('\n🛑 Shutting down worker...');
  await scraperQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('\n🛑 Shutting down worker...');
  await scraperQueue.close();
  process.exit(0);
});
