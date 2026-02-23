import { config } from "../config";
import logger from "../lib/logger";
import { scraperQueue } from "../queues/scraper.queue";

function safeRedisAddr(): string {
	if (!config.redis.url) {
		return `${config.redis.host}:${config.redis.port}`;
	}
	try {
		const u = new URL(config.redis.url);
		u.password = "";
		u.username = "";
		return u.toString();
	} catch {
		return "[invalid url]";
	}
}

logger.info("TCAD Scraper Worker started");
logger.info({ redis: safeRedisAddr() }, "Redis connection");
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
