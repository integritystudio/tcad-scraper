import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

import { config, validateConfig, logConfigSummary } from './config';
import { scraperQueue } from './queues/scraper.queue';
import { propertyRouter } from './routes/property.routes';
import { apiUsageRouter } from './routes/api-usage.routes';
import { scheduledJobs } from './schedulers/scrape-scheduler';
import { optionalAuth } from './middleware/auth';
import { nonceMiddleware } from './middleware/xcontroller.middleware';
import { appRouter } from './routes/app.routes';
import { tokenRefreshService } from './services/token-refresh.service';
import { cacheService } from './lib/redis-cache.service';
import logger from './lib/logger';
import {
  initializeSentry,
  sentryRequestHandler,
  sentryTracingHandler,
  sentryErrorHandler,
  flush as sentryFlush,
  getHealth as getSentryHealth,
} from './lib/sentry.service';
import { metricsMiddleware } from './middleware/metrics.middleware';
import { getMetrics, updateQueueMetrics } from './lib/metrics.service';
import { startPeriodicAnalysis, stopPeriodicAnalysis } from './services/code-complexity.service';

// Initialize Sentry with service tagging (must be first)
initializeSentry('tcad-scraper');

// Validate configuration
validateConfig();

// Log configuration summary
logConfigSummary();

// Create Express app
const app = express();

// Trust proxy - required for X-Forwarded-For header handling behind reverse proxy
// Set to 1 to trust the first hop (nginx reverse proxy)
// This is more secure than `true` which trusts all proxies
app.set('trust proxy', 1);

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

// Prometheus metrics middleware
app.use(metricsMiddleware);

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

  createBullBoard({
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
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env.nodeEnv,
  });
});

/**
 * @swagger
 * /health/queue:
 *   get:
 *     summary: Queue health check
 *     description: Returns BullMQ queue health status and job counts
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Queue is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 queue:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: scraper-queue
 *                     waiting:
 *                       type: integer
 *                       description: Number of jobs waiting
 *                     active:
 *                       type: integer
 *                       description: Number of jobs currently processing
 *                     completed:
 *                       type: integer
 *                       description: Number of completed jobs
 *                     failed:
 *                       type: integer
 *                       description: Number of failed jobs
 *       500:
 *         description: Queue is unhealthy
 */
app.get('/health/queue', async (_req, res) => {
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
    logger.error({ error }, 'Queue health check failed');
    res.status(500).json({
      status: 'unhealthy',
      error: 'Failed to get queue status',
    });
  }
});

/**
 * @swagger
 * /health/token:
 *   get:
 *     summary: Token refresh service health check
 *     description: Returns TCAD token refresh service health status and statistics
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Token service status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, unhealthy]
 *                 tokenRefresh:
 *                   type: object
 *                   properties:
 *                     healthy:
 *                       type: boolean
 *                     lastRefresh:
 *                       type: string
 *                       format: date-time
 *                     nextRefresh:
 *                       type: string
 *                       format: date-time
 *                     successCount:
 *                       type: integer
 *                     failureCount:
 *                       type: integer
 *       500:
 *         description: Failed to get token status
 */
app.get('/health/token', async (_req, res) => {
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
    logger.error({ error }, 'Token health check failed');
    res.status(500).json({
      status: 'unhealthy',
      error: 'Failed to get token status',
    });
  }
});

/**
 * @swagger
 * /health/cache:
 *   get:
 *     summary: Redis cache health check
 *     description: Returns Redis cache connection status and statistics
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Cache service status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, unhealthy]
 *                 cache:
 *                   type: object
 *                   properties:
 *                     connected:
 *                       type: boolean
 *                     isConnected:
 *                       type: boolean
 *                     hits:
 *                       type: integer
 *                       description: Number of cache hits
 *                     misses:
 *                       type: integer
 *                       description: Number of cache misses
 *                     hitRate:
 *                       type: number
 *                       description: Cache hit rate percentage
 *       500:
 *         description: Failed to get cache status
 */
app.get('/health/cache', async (_req, res) => {
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
    logger.error({ error }, 'Cache health check failed');
    res.status(500).json({
      status: 'unhealthy',
      error: 'Failed to get cache status',
    });
  }
});

/**
 * @swagger
 * /health/sentry:
 *   get:
 *     summary: Sentry error tracking health check
 *     description: Returns Sentry error tracking service health status
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Sentry service status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 sentry:
 *                   type: object
 *                   properties:
 *                     enabled:
 *                       type: boolean
 *                     environment:
 *                       type: string
 *                     release:
 *                       type: string
 *       500:
 *         description: Failed to get Sentry status
 */
app.get('/health/sentry', (_req, res) => {
  try {
    const health = getSentryHealth();

    res.json({
      status: 'healthy',
      sentry: health,
    });
  } catch (error) {
    logger.error({ error }, 'Sentry health check failed');
    res.status(500).json({
      status: 'unhealthy',
      error: 'Failed to get Sentry status',
    });
  }
});

/**
 * @swagger
 * /metrics:
 *   get:
 *     summary: Prometheus metrics endpoint
 *     description: Returns application metrics in Prometheus format for scraping
 *     tags: [Monitoring]
 *     responses:
 *       200:
 *         description: Prometheus metrics
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: |
 *                 # HELP tcad_scraper_http_requests_total Total number of HTTP requests
 *                 # TYPE tcad_scraper_http_requests_total counter
 *                 tcad_scraper_http_requests_total{method="GET",route="/api/properties",status_code="200"} 42
 */
app.get('/metrics', async (_req, res) => {
  try {
    // Update queue metrics before returning
    const [waiting, active, completed, failed] = await Promise.all([
      scraperQueue.getWaitingCount(),
      scraperQueue.getActiveCount(),
      scraperQueue.getCompletedCount(),
      scraperQueue.getFailedCount(),
    ]);

    await updateQueueMetrics(waiting, active, completed, failed);

    // Get cache stats and update metrics
    const cacheStats = cacheService.getStats();
    const { updateCacheMetrics } = await import('./lib/metrics.service');
    updateCacheMetrics(cacheStats.hits, cacheStats.misses, 0); // Size not tracked yet

    // Return metrics in Prometheus format
    const metrics = await getMetrics();
    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(metrics);
  } catch (error) {
    logger.error({ error }, 'Failed to generate metrics');
    res.status(500).send('Failed to generate metrics');
  }
});

// API Routes (with optional authentication)
app.use('/api/properties', optionalAuth, propertyRouter);
app.use('/api/usage', optionalAuth, apiUsageRouter);

// Frontend app routes (with xcontroller security)
// This must come last to serve the SPA for all unmatched routes
app.use('/', appRouter);

// Sentry error handler MUST be before other error handlers
app.use(sentryErrorHandler());

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');

  res.status(500).json({
    error: 'Internal server error',
    message: config.env.isDevelopment ? err.message : undefined,
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Export the app for testing
export default app;

// Only start the server if this file is run directly (not imported in tests)
// This prevents EADDRINUSE errors when multiple test files import the app
let server: ReturnType<typeof app.listen>;

if (require.main === module) {
  server = app.listen(config.server.port, config.server.host, () => {
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

  // Start periodic code complexity analysis
  logger.info('Starting periodic code complexity analysis...');
  startPeriodicAnalysis({
    updateIntervalMs: 3600000, // 1 hour (configurable)
  });
  logger.info('Code complexity analysis will run every 1 hour');
  });

  // Graceful shutdown handlers (only register when server is running)
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

    // Stop code complexity analysis
    stopPeriodicAnalysis();

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
    stopPeriodicAnalysis();

    process.exit(0);
  });
}