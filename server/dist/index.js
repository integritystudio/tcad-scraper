"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const api_1 = require("@bull-board/api");
const bullAdapter_1 = require("@bull-board/api/bullAdapter");
const express_2 = require("@bull-board/express");
const winston_1 = __importDefault(require("winston"));
const scraper_queue_1 = require("./queues/scraper.queue");
const property_routes_1 = require("./routes/property.routes");
const scrape_scheduler_1 = require("./schedulers/scrape-scheduler");
const auth_1 = require("./middleware/auth");
const xcontroller_middleware_1 = require("./middleware/xcontroller.middleware");
const app_routes_1 = require("./routes/app.routes");
// Load environment variables from .env or Doppler
dotenv_1.default.config();
// Log Doppler usage
if (process.env.DOPPLER_PROJECT) {
    console.log(`Using Doppler project: ${process.env.DOPPLER_PROJECT}`);
    console.log(`Doppler config: ${process.env.DOPPLER_CONFIG}`);
}
// Configure logger
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston_1.default.format.json(),
    transports: [
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple()),
        }),
        new winston_1.default.transports.File({
            filename: 'logs/error.log',
            level: 'error'
        }),
        new winston_1.default.transports.File({
            filename: 'logs/combined.log'
        }),
    ],
});
// Create Express app
const app = (0, express_1.default)();
// Add nonce generation for all requests (used by CSP in frontend routes)
app.use(xcontroller_middleware_1.nonceMiddleware);
// Security middleware
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: false, // Disable HSTS for HTTP access
    crossOriginOpenerPolicy: false, // Disable COOP for IP-based access
    contentSecurityPolicy: false, // CSP handled by xcontroller middleware for frontend routes
    originAgentCluster: false, // Disable Origin-Agent-Cluster for IP-based access
}));
// CORS configuration
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://alephatx.info',
    'https://www.alephatx.info',
    process.env.FRONTEND_URL,
].filter(Boolean);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));
// Body parsing middleware
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Rate limiting for API endpoints
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', apiLimiter);
// Rate limiting specifically for scraping endpoints
const scrapeLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // Limit each IP to 5 scrape requests per minute
    message: 'Too many scrape requests, please wait before trying again.',
});
app.use('/api/properties/scrape', scrapeLimiter);
// Bull Dashboard setup
const serverAdapter = new express_2.ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
const { addQueue, removeQueue, setQueues, replaceQueues } = (0, api_1.createBullBoard)({
    queues: [new bullAdapter_1.BullAdapter(scraper_queue_1.scraperQueue)],
    serverAdapter,
});
app.use('/admin/queues', serverAdapter.getRouter());
// Health check endpoints (before other routes)
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
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
        message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
});
// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
// Start server
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const server = app.listen(PORT, HOST, () => {
    logger.info(`Server running on http://${HOST}:${PORT}`);
    logger.info(`Bull Dashboard available at http://${HOST}:${PORT}/admin/queues`);
    logger.info(`Environment: ${process.env.NODE_ENV}`);
    // Initialize scheduled jobs
    scrape_scheduler_1.scheduledJobs.initialize();
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
    process.exit(0);
});
process.on('SIGINT', async () => {
    logger.info('SIGINT signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
    });
    await scraper_queue_1.scraperQueue.close();
    scrape_scheduler_1.scheduledJobs.stop();
    process.exit(0);
});
exports.default = app;
//# sourceMappingURL=index.js.map