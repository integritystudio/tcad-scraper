import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { type Queue } from "bullmq";
import { type RedisOptions } from "ioredis";
import { getQueue, discoverQueues } from "../shared/bullmq-utils.js";

const PORT = Number(process.env.PORT) || 3000;
const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;

const connection: RedisOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
};

const queues = new Map<string, Queue>();

function getQueueByName(queueName: string): Queue {
  return getQueue(queueName, connection, queues);
}

const server = http.createServer(
  async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (req.url === "/metrics" && req.method === "GET") {
        const queueNames = await discoverQueues(connection);

        if (queueNames.length === 0) {
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("# No queues found\n");
          return;
        }

        let allMetrics = "";
        for (const queueName of queueNames) {
          try {
            const queue = getQueueByName(queueName);
            const metrics = await queue.exportPrometheusMetrics();
            allMetrics += `${metrics}\n`;
          } catch (error) {
            console.error(
              `Error getting metrics for queue ${queueName}:`,
              error,
            );
          }
        }

        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end(allMetrics);
      } else if (req.url === "/health" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
      } else if (req.url === "/queues" && req.method === "GET") {
        const queueNames = await discoverQueues(connection);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ queues: queueNames }));
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
      }
    } catch (error: unknown) {
      console.error("Request error:", error);
      res.writeHead(500, { "Content-Type": "text/plain" });
      const message =
        error instanceof Error ? error.message : "Unknown error";
      res.end(`Error: ${message}`);
    }
  },
);

server.listen(PORT, () => {
  console.log(`BullMQ Prometheus metrics exporter running on port ${PORT}`);
  console.log(`Metrics available at http://localhost:${PORT}/metrics`);
  console.log(`Health check at http://localhost:${PORT}/health`);
  console.log(`Queue list at http://localhost:${PORT}/queues`);
});

process.on("SIGTERM", async () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close();
  for (const queue of queues.values()) {
    await queue.close();
  }
  process.exit(0);
});
