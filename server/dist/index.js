"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const api_1 = require("@bull-board/api");
const bullAdapter_1 = require("@bull-board/api/bullAdapter");
const express_2 = require("@bull-board/express");
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_1 = require("./config/swagger");
const config_1 = require("./config");
const scraper_queue_1 = require("./queues/scraper.queue");
const property_routes_1 = require("./routes/property.routes");
const scrape_scheduler_1 = require("./schedulers/scrape-scheduler");
const auth_1 = require("./middleware/auth");
const xcontroller_middleware_1 = require("./middleware/xcontroller.middleware");
const app_routes_1 = require("./routes/app.routes");
const token_refresh_service_1 = require("./services/token-refresh.service");
const redis_cache_service_1 = require("./lib/redis-cache.service");
const logger_1 = __importDefault(require("./lib/logger"));
const sentry_service_1 = require("./lib/sentry.service");
const metrics_middleware_1 = require("./middleware/metrics.middleware");
const metrics_service_1 = require("./lib/metrics.service");
const code_complexity_service_1 = require("./services/code-complexity.service");
// Initialize Sentry (must be first)
(0, sentry_service_1.initializeSentry)();
// Validate configuration
(0, config_1.validateConfig)();
// Log configuration summary
(0, config_1.logConfigSummary)();
// Create Express app
const app = (0, express_1.default)();
// Sentry request handler MUST be the first middleware
app.use((0, sentry_service_1.sentryRequestHandler)());
// Sentry tracing handler (for performance monitoring)
app.use((0, sentry_service_1.sentryTracingHandler)());
// Add nonce generation for all requests (used by CSP in frontend routes)
app.use(xcontroller_middleware_1.nonceMiddleware);
// Security middleware - exclude Bull Board dashboard from CSP
app.use((req, res, next) => {
    // Skip CSP for Bull Board dashboard
    if (req.path.startsWith(config_1.config.queue.dashboard.basePath)) {
        return next();
    }
    (0, helmet_1.default)({
        crossOriginResourcePolicy: { policy: config_1.config.security.helmet.crossOriginResourcePolicy },
        hsts: config_1.config.security.helmet.enableHsts,
        crossOriginOpenerPolicy: config_1.config.security.helmet.enableCoop,
        contentSecurityPolicy: config_1.config.security.helmet.enableCsp,
        originAgentCluster: config_1.config.security.helmet.enableOriginAgentCluster,
    })(req, res, next);
});
// CORS configuration
const allowedOrigins = config_1.config.frontend.url
    ? [...config_1.config.cors.allowedOrigins, config_1.config.frontend.url]
    : config_1.config.cors.allowedOrigins;
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin && config_1.config.cors.allowNoOrigin)
            return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: config_1.config.cors.credentials,
}));
// Body parsing middleware
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Prometheus metrics middleware
app.use(metrics_middleware_1.metricsMiddleware);
// Rate limiting for API endpoints
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: config_1.config.rateLimit.api.windowMs,
    max: config_1.config.rateLimit.api.max,
    message: config_1.config.rateLimit.api.message,
});
app.use('/api/', apiLimiter);
// Rate limiting specifically for scraping endpoints
const scrapeLimiter = (0, express_rate_limit_1.default)({
    windowMs: config_1.config.rateLimit.scraper.windowMs,
    max: config_1.config.rateLimit.scraper.max,
    message: config_1.config.rateLimit.scraper.message,
});
app.use('/api/properties/scrape', scrapeLimiter);
// Bull Dashboard setup
if (config_1.config.queue.dashboard.enabled) {
    const serverAdapter = new express_2.ExpressAdapter();
    serverAdapter.setBasePath(config_1.config.queue.dashboard.basePath);
    (0, api_1.createBullBoard)({
        queues: [new bullAdapter_1.BullAdapter(scraper_queue_1.scraperQueue)],
        serverAdapter,
    });
    app.use(config_1.config.queue.dashboard.basePath, serverAdapter.getRouter());
    logger_1.default.info(`Bull Dashboard enabled at ${config_1.config.queue.dashboard.basePath}`);
}
// Swagger API Documentation
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec, {
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
logger_1.default.info('Swagger API documentation available at /api-docs');
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
        environment: config_1.config.env.nodeEnv,
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
            scraper_queue_1.scraperQueue.getWaitingCount(),
            scraper_queue_1.scraperQueue.getActiveCount(),
            scraper_queue_1.scraperQueue.getCompletedCount(),
            scraper_queue_1.scraperQueue.getFailedCount(),
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
    }
    catch (error) {
        logger_1.default.error({ error }, 'Queue health check failed');
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
        const health = token_refresh_service_1.tokenRefreshService.getHealth();
        const stats = token_refresh_service_1.tokenRefreshService.getStats();
        res.json({
            status: health.healthy ? 'healthy' : 'unhealthy',
            tokenRefresh: {
                ...health,
                ...stats,
            },
        });
    }
    catch (error) {
        logger_1.default.error({ error }, 'Token health check failed');
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
        const healthy = await redis_cache_service_1.cacheService.healthCheck();
        const stats = redis_cache_service_1.cacheService.getStats();
        res.json({
            status: healthy ? 'healthy' : 'unhealthy',
            cache: {
                connected: stats.isConnected,
                ...stats,
            },
        });
    }
    catch (error) {
        logger_1.default.error({ error }, 'Cache health check failed');
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
        const health = (0, sentry_service_1.getHealth)();
        res.json({
            status: 'healthy',
            sentry: health,
        });
    }
    catch (error) {
        logger_1.default.error({ error }, 'Sentry health check failed');
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
            scraper_queue_1.scraperQueue.getWaitingCount(),
            scraper_queue_1.scraperQueue.getActiveCount(),
            scraper_queue_1.scraperQueue.getCompletedCount(),
            scraper_queue_1.scraperQueue.getFailedCount(),
        ]);
        await (0, metrics_service_1.updateQueueMetrics)(waiting, active, completed, failed);
        // Get cache stats and update metrics
        const cacheStats = redis_cache_service_1.cacheService.getStats();
        const { updateCacheMetrics } = await Promise.resolve().then(() => __importStar(require('./lib/metrics.service')));
        updateCacheMetrics(cacheStats.hits, cacheStats.misses, 0); // Size not tracked yet
        // Return metrics in Prometheus format
        const metrics = await (0, metrics_service_1.getMetrics)();
        res.set('Content-Type', 'text/plain; version=0.0.4');
        res.send(metrics);
    }
    catch (error) {
        logger_1.default.error({ error }, 'Failed to generate metrics');
        res.status(500).send('Failed to generate metrics');
    }
});
// API Routes (with optional authentication)
app.use('/api/properties', auth_1.optionalAuth, property_routes_1.propertyRouter);
// Frontend app routes (with xcontroller security)
// This must come last to serve the SPA for all unmatched routes
app.use('/', app_routes_1.appRouter);
// Sentry error handler MUST be before other error handlers
app.use((0, sentry_service_1.sentryErrorHandler)());
// Error handling middleware
app.use((err, _req, res, _next) => {
    logger_1.default.error({ err }, 'Unhandled error');
    res.status(500).json({
        error: 'Internal server error',
        message: config_1.config.env.isDevelopment ? err.message : undefined,
    });
});
// 404 handler
app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
// Start server
const server = app.listen(config_1.config.server.port, config_1.config.server.host, () => {
    logger_1.default.info(`Server running on http://${config_1.config.server.host}:${config_1.config.server.port}`);
    if (config_1.config.queue.dashboard.enabled) {
        logger_1.default.info(`Bull Dashboard available at http://${config_1.config.server.host}:${config_1.config.server.port}${config_1.config.queue.dashboard.basePath}`);
    }
    logger_1.default.info(`Environment: ${config_1.config.env.nodeEnv}`);
    // Initialize scheduled jobs
    scrape_scheduler_1.scheduledJobs.initialize();
    // Start automatic token refresh if enabled
    if (config_1.config.scraper.autoRefreshToken) {
        logger_1.default.info('Starting TCAD token auto-refresh service...');
        if (config_1.config.scraper.tokenRefreshCron) {
            // Use cron schedule if provided
            token_refresh_service_1.tokenRefreshService.startAutoRefresh(config_1.config.scraper.tokenRefreshCron);
            logger_1.default.info(`Token refresh scheduled with cron: ${config_1.config.scraper.tokenRefreshCron}`);
        }
        else {
            // Use interval-based refresh
            token_refresh_service_1.tokenRefreshService.startAutoRefreshInterval(config_1.config.scraper.tokenRefreshInterval);
            logger_1.default.info(`Token refresh scheduled every ${config_1.config.scraper.tokenRefreshInterval / 60000} minutes`);
        }
    }
    else {
        logger_1.default.info('TCAD token auto-refresh is disabled');
    }
    // Start periodic code complexity analysis
    logger_1.default.info('Starting periodic code complexity analysis...');
    (0, code_complexity_service_1.startPeriodicAnalysis)({
        updateIntervalMs: 3600000, // 1 hour (configurable)
    });
    logger_1.default.info('Code complexity analysis will run every 1 hour');
});
// Graceful shutdown
process.on('SIGTERM', async () => {
    logger_1.default.info('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        logger_1.default.info('HTTP server closed');
    });
    // Flush Sentry events before shutdown
    logger_1.default.info('Flushing Sentry events...');
    await (0, sentry_service_1.flush)(2000);
    // Close queue connections
    await scraper_queue_1.scraperQueue.close();
    // Close scheduled jobs
    scrape_scheduler_1.scheduledJobs.stop();
    // Cleanup token refresh service
    await token_refresh_service_1.tokenRefreshService.cleanup();
    // Stop code complexity analysis
    (0, code_complexity_service_1.stopPeriodicAnalysis)();
    process.exit(0);
});
process.on('SIGINT', async () => {
    logger_1.default.info('SIGINT signal received: closing HTTP server');
    server.close(() => {
        logger_1.default.info('HTTP server closed');
    });
    // Flush Sentry events before shutdown
    await (0, sentry_service_1.flush)(2000);
    await scraper_queue_1.scraperQueue.close();
    scrape_scheduler_1.scheduledJobs.stop();
    await token_refresh_service_1.tokenRefreshService.cleanup();
    (0, code_complexity_service_1.stopPeriodicAnalysis)();
    process.exit(0);
});
exports.default = app;
//# sourceMappingURL=index.js.map