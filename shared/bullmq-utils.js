/**
 * Shared BullMQ utilities for queue management
 * Used by both the main server and the Prometheus exporter
 */

const { Queue } = require("bullmq");

/**
 * Get or create a queue instance
 * @param {string} queueName - Name of the queue
 * @param {object} connection - Redis connection configuration
 * @param {Map} queues - Map to store queue instances
 * @returns {Queue} BullMQ Queue instance
 */
function getQueue(queueName, connection, queues) {
	if (!queues.has(queueName)) {
		const queue = new Queue(queueName, { connection });
		queues.set(queueName, queue);
	}
	return queues.get(queueName);
}

/**
 * Discover all BullMQ queues from Redis
 * @param {object} connection - Redis connection configuration
 * @returns {Promise<string[]>} Array of queue names
 */
async function discoverQueues(connection) {
	try {
		const Redis = require("ioredis");
		const redis = new Redis(connection);

		// Find all BullMQ queues
		const keys = await redis.keys("bull:*:meta");
		const queueNames = new Set();

		keys.forEach((key) => {
			const match = key.match(/^bull:([^:]+):meta$/);
			if (match) {
				queueNames.add(match[1]);
			}
		});

		await redis.quit();
		return Array.from(queueNames);
	} catch (error) {
		console.error("Error discovering queues:", error);
		return [];
	}
}

module.exports = {
	getQueue,
	discoverQueues,
};
