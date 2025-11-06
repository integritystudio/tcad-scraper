const http = require('http');
const { Queue } = require('bullmq');

const PORT = process.env.PORT;
const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_PORT = process.env.REDIS_PORT;

const connection = {
  host: REDIS_HOST,
  port: REDIS_PORT,
};

const queues = new Map();

function getQueue(queueName) {
  if (!queues.has(queueName)) {
    const queue = new Queue(queueName, { connection });
    queues.set(queueName, queue);
  }
  return queues.get(queueName);
}

async function discoverQueues() {
  try {
    const Redis = require('ioredis');
    const redis = new Redis(connection);
    const keys = await redis.keys('bull:*:meta');
    const queueNames = new Set();

    keys.forEach(key => {
      const match = key.match(/^bull:([^:]+):meta$/);
      if (match) {
        queueNames.add(match[1]);
      }
    });

    await redis.quit();
    return Array.from(queueNames);
  } catch (error) {
    console.error('Error discovering queues:', error);
    return [];
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/metrics' && req.method === 'GET') {
      const queueNames = await discoverQueues();

      if (queueNames.length === 0) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return res.end('# No queues found\n');
      }

      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(allMetrics);
    }
    else if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    }
    else if (req.url === '/queues' && req.method === 'GET') {
      const queueNames = await discoverQueues();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ queues: queueNames }));
    }
    else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  } catch (error) {
    console.error('Request error:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`Error: ${error.message}`);
  }
});

server.listen(PORT, () => {
  console.log(`BullMQ Prometheus metrics exporter running on port ${PORT}`);
  console.log(`Metrics available at http://localhost:${PORT}/metrics`);
  console.log(`Health check at http://localhost:${PORT}/health`);
  console.log(`Queue list at http://localhost:${PORT}/queues`);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close();
  for (const queue of queues.values()) {
    await queue.close();
  }
  process.exit(0);
});
