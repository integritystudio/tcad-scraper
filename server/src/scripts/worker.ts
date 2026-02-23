import { config } from "../config";
import logger from "../lib/logger";
import { scraperQueue } from "../queues/scraper.queue";

const redisAddr = config.redis.url ?? `${config.redis.host}:${config.redis.port}`;

logger.info("TCAD Scraper Worker started");
logger.info({ redis: redisAddr }, "Redis connection");
logger.info({ database: config.database.url ? "configured" : "not configured" }, "Database");
logger.info("Listening for jobs");

// Graceful shutdown
process.on("SIGTERM", async () => {
	logger.info("Shutting down worker (SIGTERM)");
	await scraperQueue.close();
	process.exit(0);
});

process.on("SIGINT", async () => {
	logger.info("Shutting down worker (SIGINT)");
	await scraperQueue.close();
	process.exit(0);
});
