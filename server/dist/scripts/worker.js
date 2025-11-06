"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const scraper_queue_1 = require("../queues/scraper.queue");
const winston_1 = __importDefault(require("winston"));
const logger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.simple()),
    transports: [
        new winston_1.default.transports.Console(),
    ],
});
logger.info('🚀 TCAD Scraper Worker started');
logger.info(`   Redis: ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`);
logger.info(`   Database: ${process.env.DATABASE_URL}`);
logger.info('\n👂 Listening for jobs...\n');
// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('\n🛑 Shutting down worker...');
    await scraper_queue_1.scraperQueue.close();
    process.exit(0);
});
process.on('SIGINT', async () => {
    logger.info('\n🛑 Shutting down worker...');
    await scraper_queue_1.scraperQueue.close();
    process.exit(0);
});
//# sourceMappingURL=worker.js.map