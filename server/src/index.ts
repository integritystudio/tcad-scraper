import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import winston from 'winston';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

import { config, validateConfig, logConfigSummary } from './config';
import { scraperQueue } from './queues/scraper.queue';
import { propertyRouter } from './routes/property.routes';
import { scheduledJobs } from './schedulers/scrape-scheduler';
import { optionalAuth } from './middleware/auth';
import { nonceMiddleware } from './middleware/xcontroller.middleware';
import { appRouter } from './routes/app.routes';
import { tokenRefreshService } from './services/token-refresh.service';
import { cacheService } from './lib/redis-cache.service';
import {
  initializeSentry,
  sentryRequestHandler,
  sentryTracingHandler,
  sentryErrorHandler,
  flush as sentryFlush,
  getHealth as getSentryHealth,
} from './lib/sentry.service';

// Initialize Sentry (must be first)
initializeSentry();

// Validate configuration
validateConfig();

// Log configuration summary
logConfigSummary();

// Configure logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.json(),
  transports: [
    ...(config.logging.console.enabled
      ? [
          new winston.transports.Console({
            format: winston.format.combine(
              config.logging.colorize ? winston.format.colorize() : winston.format.simple(),
              winston.format.simple()
            ),
          }),
        ]
      : []),
    ...(config.logging.files.enabled
      ? [
          new winston.transports.File({
            filename: config.logging.files.error,
            level: 'error',
          }),
          new winston.transports.File({
            filename: config.logging.files.combined,
          }),
        ]
      : []),
  ],
});

// Create Express app
const app = express();

// Sentry request handler MUST be the first middleware
app.use(sentryRequestHandler());

// Sentry tracing handler (for performance monitoring)
app.use(sentryTracingHandler());

// Add nonce generation for all requests (used by CSP in frontend routes)
app.use(nonceMiddleware);

// Security middleware - exclude Bull Board dashboard from CSP
app.use((req, res, next) => {
  // Skip CSP for Bull Board dashboard
  if (req.path.startsWith(config.queue.dashboard.basePath)) {
    return next();
  }

  helmet({
    crossOriginResourcePolicy: { policy: config.security.helmet.crossOriginResourcePolicy as any },
    hsts: config.security.helmet.enableHsts,
    crossOriginOpenerPolicy: config.security.helmet.enableCoop,
    contentSecurityPolicy: config.security.helmet.enableCsp,
    originAgentCluster: config.security.helmet.enableOriginAgentCluster,
  })(req, res, next);
});

// CORS configuration
const allowedOrigins = config.frontend.url
  ? [...config.cors.allowedOrigins, config.frontend.url]
  : config.cors.allowedOrigins;

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin && config.cors.allowNoOrigin) return callback(null, true);

    if (allowedOrigins.includes(origin as string)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: config.cors.credentials,
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.api.windowMs,
  max: config.rateLimit.api.max,
  message: config.rateLimit.api.message,
});

app.use('/api/', apiLimiter);

// Rate limiting specifically for scraping endpoints
const scrapeLimiter = rateLimit({
  windowMs: config.rateLimit.scraper.windowMs,
  max: config.rateLimit.scraper.max,
  message: config.rateLimit.scraper.message,
});

app.use('/api/properties/scrape', scrapeLimiter);

// Bull Dashboard setup
if (config.queue.dashboard.enabled) {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(config.queue.dashboard.basePath);

  const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
    queues: [new BullAdapter(scraperQueue)],
    serverAdapter,
  });

  app.use(config.queue.dashboard.basePath, serverAdapter.getRouter());
  logger.info(`Bull Dashboard enabled at ${config.queue.dashboard.basePath}`);
}

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'TCAD Scraper API Docs',
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    syntaxHighlight: {
      activate: true,
      theme: 'monokai',
    },
  },
}));
logger.info('Swagger API documentation available at /api-docs');

// Health check endpoints (before other routes)

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     description: Returns basic server health status and uptime
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                 environment:
 *                   type: string
 *                   example: production
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env.nodeEnv,
  });
});

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

app.get('/health/token', async (req, res) => {
  try {
    const health = tokenRefreshService.getHealth();
    const stats = tokenRefreshService.getStats();

    res.json({
      status: health.healthy ? 'healthy' : 'unhealthy',
      tokenRefresh: {
        ...health,
        ...stats,
      },
    });
  } catch (error) {
    logger.error('Token health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Failed to get token status',
    });
  }
});

app.get('/health/cache', async (req, res) => {
  try {
    const healthy = await cacheService.healthCheck();
    const stats = cacheService.getStats();

    res.json({
      status: healthy ? 'healthy' : 'unhealthy',
      cache: {
        connected: stats.isConnected,
        ...stats,
      },
    });
  } catch (error) {
    logger.error('Cache health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Failed to get cache status',
    });
  }
});

app.get('/health/sentry', (req, res) => {
  try {
    const health = getSentryHealth();

    res.json({
      status: 'healthy',
      sentry: health,
    });
  } catch (error) {
    logger.error('Sentry health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Failed to get Sentry status',
    });
  }
});

// API Routes (with optional authentication)
app.use('/api/properties', optionalAuth, propertyRouter);

// Frontend app routes (with xcontroller security)
// This must come last to serve the SPA for all unmatched routes
app.use('/', appRouter);

// Sentry error handler MUST be before other error handlers
app.use(sentryErrorHandler());

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);

  res.status(500).json({
    error: 'Internal server error',
    message: config.env.isDevelopment ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const server = app.listen(config.server.port, config.server.host, () => {
  logger.info(`Server running on http://${config.server.host}:${config.server.port}`);
  if (config.queue.dashboard.enabled) {
    logger.info(`Bull Dashboard available at http://${config.server.host}:${config.server.port}${config.queue.dashboard.basePath}`);
  }
  logger.info(`Environment: ${config.env.nodeEnv}`);

  // Initialize scheduled jobs
  scheduledJobs.initialize();

  // Start automatic token refresh if enabled
  if (config.scraper.autoRefreshToken) {
    logger.info('Starting TCAD token auto-refresh service...');

    if (config.scraper.tokenRefreshCron) {
      // Use cron schedule if provided
      tokenRefreshService.startAutoRefresh(config.scraper.tokenRefreshCron);
      logger.info(`Token refresh scheduled with cron: ${config.scraper.tokenRefreshCron}`);
    } else {
      // Use interval-based refresh
      tokenRefreshService.startAutoRefreshInterval(config.scraper.tokenRefreshInterval);
      logger.info(`Token refresh scheduled every ${config.scraper.tokenRefreshInterval / 60000} minutes`);
    }
  } else {
    logger.info('TCAD token auto-refresh is disabled');
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');

  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Flush Sentry events before shutdown
  logger.info('Flushing Sentry events...');
  await sentryFlush(2000);

  // Close queue connections
  await scraperQueue.close();

  // Close scheduled jobs
  scheduledJobs.stop();

  // Cleanup token refresh service
  await tokenRefreshService.cleanup();

  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');

  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Flush Sentry events before shutdown
  await sentryFlush(2000);

  await scraperQueue.close();
  scheduledJobs.stop();
  await tokenRefreshService.cleanup();

  process.exit(0);
});

export default app;