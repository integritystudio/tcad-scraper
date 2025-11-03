import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import winston from 'winston';

import { scraperQueue } from './queues/scraper.queue';
import { propertyRouter } from './routes/property.routes';
import { scheduledJobs } from './schedulers/scrape-scheduler';
import { optionalAuth } from './middleware/auth';

// Load environment variables from .env or Doppler
dotenv.config();

// Log Doppler usage
if (process.env.DOPPLER_PROJECT) {
  console.log(`Using Doppler project: ${process.env.DOPPLER_PROJECT}`);
  console.log(`Doppler config: ${process.env.DOPPLER_CONFIG}`);
}

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    }),
  ],
});

// Create Express app
const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: false, // Disable HSTS for HTTP access
  crossOriginOpenerPolicy: false, // Disable COOP for IP-based access
  contentSecurityPolicy: false, // Disable CSP for IP-based access
  originAgentCluster: false, // Disable Origin-Agent-Cluster for IP-based access
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

app.use('/api/', apiLimiter);

// Rate limiting specifically for scraping endpoints
const scrapeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Limit each IP to 5 scrape requests per minute
  message: 'Too many scrape requests, please wait before trying again.',
});

app.use('/api/properties/scrape', scrapeLimiter);

// Bull Dashboard setup
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
  queues: [new BullAdapter(scraperQueue)],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

// API Routes (with optional authentication)
app.use('/api/properties', optionalAuth, propertyRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// Queue health check
app.get('/health/queue', async (req, res) => {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      scraperQueue.getWaitingCount(),
      scraperQueue.getActiveCount(),
      scraperQueue.getCompletedCount(),
      scraperQueue.getFailedCount(),
    ]);

    res.json({
      status: 'healthy',
      queue: {
        name: 'scraper-queue',
        waiting,
        active,
        completed,
        failed,
      },
    });
  } catch (error) {
    logger.error('Queue health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Failed to get queue status',
    });
  }
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || 'localhost';

const server = app.listen(PORT, () => {
  logger.info(`Server running on http://${HOST}:${PORT}`);
  logger.info(`Bull Dashboard available at http://${HOST}:${PORT}/admin/queues`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);

  // Initialize scheduled jobs
  scheduledJobs.initialize();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');

  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Close queue connections
  await scraperQueue.close();

  // Close scheduled jobs
  scheduledJobs.stop();

  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');

  server.close(() => {
    logger.info('HTTP server closed');
  });

  await scraperQueue.close();
  scheduledJobs.stop();

  process.exit(0);
});

export default app;