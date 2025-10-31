const express = require('express');
const { Queue } = require('bullmq');

const app = express();
const PORT = process.env.PORT || 3000;
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

// Connection configuration
const connection = {
  host: REDIS_HOST,
  port: REDIS_PORT,
};

// Store queue instances
const queues = new Map();

// Function to get or create a queue instance
function getQueue(queueName) {
  if (!queues.has(queueName)) {
    const queue = new Queue(queueName, { connection });
    queues.set(queueName, queue);
  }
  return queues.get(queueName);
}

// Discover queues from Redis
async function discoverQueues() {
  try {
    const Redis = require('ioredis');
    const redis = new Redis(connection);
    
    // Find all BullMQ queues
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

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    const queueNames = await discoverQueues();
    
    if (queueNames.length === 0) {
      res.set('Content-Type', 'text/plain');
      return res.send('# No queues found\n');
    }

    let allMetrics = '';
    
    // Gather metrics from all discovered queues
    for (const queueName of queueNames) {
      try {
        const queue = getQueue(queueName);
        const metrics = await queue.exportPrometheusMetrics();
        allMetrics += metrics + '\n';
      } catch (error) {
        console.error(`Error getting metrics for queue ${queueName}:`, error);
      }
    }
    
    res.set('Content-Type', 'text/plain');
    res.send(allMetrics);
  } catch (error) {
    console.error('Error generating metrics:', error);
    res.status(500).send(`Error: ${error.message}`);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// List discovered queues
app.get('/queues', async (req, res) => {
  try {
    const queueNames = await discoverQueues();
    res.json({ queues: queueNames });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`BullMQ Prometheus metrics exporter running on port ${PORT}`);
  console.log(`Metrics available at http://localhost:${PORT}/metrics`);
  console.log(`Health check at http://localhost:${PORT}/health`);
  console.log(`Queue list at http://localhost:${PORT}/queues`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  for (const queue of queues.values()) {
    await queue.close();
  }
  process.exit(0);
});
