"use strict";
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
const winston_1 = __importDefault(require("winston"));
const config_1 = require("./config");
const scraper_queue_1 = require("./queues/scraper.queue");
const property_routes_1 = require("./routes/property.routes");
const scrape_scheduler_1 = require("./schedulers/scrape-scheduler");
const auth_1 = require("./middleware/auth");
const xcontroller_middleware_1 = require("./middleware/xcontroller.middleware");
const app_routes_1 = require("./routes/app.routes");
const token_refresh_service_1 = require("./services/token-refresh.service");
// Validate configuration
(0, config_1.validateConfig)();
// Log configuration summary
(0, config_1.logConfigSummary)();
// Configure logger
const logger = winston_1.default.createLogger({
    level: config_1.config.logging.level,
    format: winston_1.default.format.json(),
    transports: [
        ...(config_1.config.logging.console.enabled
            ? [
                new winston_1.default.transports.Console({
                    format: winston_1.default.format.combine(config_1.config.logging.colorize ? winston_1.default.format.colorize() : winston_1.default.format.simple(), winston_1.default.format.simple()),
                }),
            ]
            : []),
        ...(config_1.config.logging.files.enabled
            ? [
                new winston_1.default.transports.File({
                    filename: config_1.config.logging.files.error,
                    level: 'error',
                }),
                new winston_1.default.transports.File({
                    filename: config_1.config.logging.files.combined,
                }),
            ]
            : []),
    ],
});
// Create Express app
const app = (0, express_1.default)();
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
    const { addQueue, removeQueue, setQueues, replaceQueues } = (0, api_1.createBullBoard)({
        queues: [new bullAdapter_1.BullAdapter(scraper_queue_1.scraperQueue)],
        serverAdapter,
    });
    app.use(config_1.config.queue.dashboard.basePath, serverAdapter.getRouter());
    logger.info(`Bull Dashboard enabled at ${config_1.config.queue.dashboard.basePath}`);
}
// Health check endpoints (before other routes)
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config_1.config.env.nodeEnv,
    });
});
app.get('/health/queue', async (req, res) => {
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
        logger.error('Queue health check failed:', error);
        res.status(500).json({
            status: 'unhealthy',
            error: 'Failed to get queue status',
        });
    }
});
app.get('/health/token', async (req, res) => {
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
        logger.error('Token health check failed:', error);
        res.status(500).json({
            status: 'unhealthy',
            error: 'Failed to get token status',
        });
    }
});
// API Routes (with optional authentication)
app.use('/api/properties', auth_1.optionalAuth, property_routes_1.propertyRouter);
// Frontend app routes (with xcontroller security)
// This must come last to serve the SPA for all unmatched routes
app.use('/', app_routes_1.appRouter);
// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: config_1.config.env.isDevelopment ? err.message : undefined,
    });
});
// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
// Start server
const server = app.listen(config_1.config.server.port, config_1.config.server.host, () => {
    logger.info(`Server running on http://${config_1.config.server.host}:${config_1.config.server.port}`);
    if (config_1.config.queue.dashboard.enabled) {
        logger.info(`Bull Dashboard available at http://${config_1.config.server.host}:${config_1.config.server.port}${config_1.config.queue.dashboard.basePath}`);
    }
    logger.info(`Environment: ${config_1.config.env.nodeEnv}`);
    // Initialize scheduled jobs
    scrape_scheduler_1.scheduledJobs.initialize();
    // Start automatic token refresh if enabled
    if (config_1.config.scraper.autoRefreshToken) {
        logger.info('Starting TCAD token auto-refresh service...');
        if (config_1.config.scraper.tokenRefreshCron) {
            // Use cron schedule if provided
            token_refresh_service_1.tokenRefreshService.startAutoRefresh(config_1.config.scraper.tokenRefreshCron);
            logger.info(`Token refresh scheduled with cron: ${config_1.config.scraper.tokenRefreshCron}`);
        }
        else {
            // Use interval-based refresh
            token_refresh_service_1.tokenRefreshService.startAutoRefreshInterval(config_1.config.scraper.tokenRefreshInterval);
            logger.info(`Token refresh scheduled every ${config_1.config.scraper.tokenRefreshInterval / 60000} minutes`);
        }
    }
    else {
        logger.info('TCAD token auto-refresh is disabled');
    }
});
// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
    });
    // Close queue connections
    await scraper_queue_1.scraperQueue.close();
    // Close scheduled jobs
    scrape_scheduler_1.scheduledJobs.stop();
    // Cleanup token refresh service
    await token_refresh_service_1.tokenRefreshService.cleanup();
    process.exit(0);
});
process.on('SIGINT', async () => {
    logger.info('SIGINT signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
    });
    await scraper_queue_1.scraperQueue.close();
    scrape_scheduler_1.scheduledJobs.stop();
    await token_refresh_service_1.tokenRefreshService.cleanup();
    process.exit(0);
});
exports.default = app;
//# sourceMappingURL=index.js.map