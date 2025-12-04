const express = require("express");
const { discoverQueues } = require("./shared/bullmq-utils");

const app = express();
const PORT = process.env.PORT;
const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_PORT = process.env.REDIS_PORT;

// Connection configuration
const connection = {
	host: REDIS_HOST,
	port: REDIS_PORT,
};

// Store queue instances
const queues = new Map();

// Health check endpoint
app.get("/health", (_req, res) => {
	res.json({ status: "ok" });
});

// List discovered queues
app.get("/queues", async (_req, res) => {
	try {
		const queueNames = await discoverQueues(connection);
		res.json({ queues: queueNames });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

app.listen(PORT, () => {
	console.log(`Health check at http://localhost:${PORT}/health`);
	console.log(`Queue list at http://localhost:${PORT}/queues`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
	console.log("SIGTERM signal received: closing HTTP server");
	for (const queue of queues.values()) {
		await queue.close();
	}
	process.exit(0);
});
