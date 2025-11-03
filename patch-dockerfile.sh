#!/bin/bash

echo "🔧 Docker Build Fix Script"
echo "=========================="
echo ""

# Find the directory containing docker-compose.yml
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo "📂 Running from: $SCRIPT_DIR"

# Check if we're in the right directory
if [ ! -f "$SCRIPT_DIR/docker-compose.yml" ]; then
    echo ""
    echo "❌ Error: docker-compose.yml not found in current directory"
    echo ""
    echo "You need to run this script from the directory containing:"
    echo "  - docker-compose.yml"
    echo "  - bullmq-exporter/"
    echo "  - prometheus.yml"
    echo ""
    echo "Did you download all the files from Claude?"
    echo "They should all be in the same directory."
    echo ""
    echo "Try:"
    echo "  cd /path/to/downloaded/files"
    echo "  ./patch-dockerfile.sh"
    exit 1
fi

# Check if bullmq-exporter directory exists
if [ ! -d "$SCRIPT_DIR/bullmq-exporter" ]; then
    echo ""
    echo "❌ Error: bullmq-exporter directory not found"
    echo ""
    echo "Creating bullmq-exporter directory..."
    mkdir -p "$SCRIPT_DIR/bullmq-exporter"
fi

echo "✅ Found docker-compose.yml"
echo ""

# Stop and clean up
echo "🛑 Stopping any running containers..."
cd "$SCRIPT_DIR"
docker-compose down 2>/dev/null
docker-compose rm -f 2>/dev/null
echo "✅ Cleaned up"
echo ""

# Update Dockerfile
echo "📝 Updating Dockerfile..."
cat > "$SCRIPT_DIR/bullmq-exporter/Dockerfile" << 'DOCKERFILEEOF'
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production --omit=optional --no-optional

COPY index.js ./

EXPOSE 3000

CMD ["npm", "start"]
DOCKERFILEEOF

echo "✅ Updated bullmq-exporter/Dockerfile"

# Update package.json
echo "📝 Updating package.json..."
cat > "$SCRIPT_DIR/bullmq-exporter/package.json" << 'PACKAGEEOF'
{
  "name": "bullmq-metrics-exporter",
  "version": "1.0.0",
  "description": "BullMQ Prometheus metrics exporter",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "bullmq": "5.28.2",
    "ioredis": "5.4.1"
  }
}
PACKAGEEOF

echo "✅ Updated bullmq-exporter/package.json"

# Update index.js
echo "📝 Updating index.js..."
cat > "$SCRIPT_DIR/bullmq-exporter/index.js" << 'INDEXEOF'
const http = require('http');
const { Queue } = require('bullmq');

const PORT = process.env.PORT || 3000;
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

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

      let allMetrics = '';
      for (const queueName of queueNames) {
        try {
          const queue = getQueue(queueName);
          const metrics = await queue.exportPrometheusMetrics();
          allMetrics += metrics + '\n';
        } catch (error) {
          console.error(`Error getting metrics for queue ${queueName}:`, error);
        }
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
INDEXEOF

echo "✅ Updated bullmq-exporter/index.js"
echo ""

# Rebuild
echo "🚀 Rebuilding Docker images..."
cd "$SCRIPT_DIR"
docker-compose build --no-cache bullmq-metrics

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build successful!"
    echo ""
    echo "🚀 Starting services..."
    docker-compose up -d

    if [ $? -eq 0 ]; then
        echo ""
        echo "╔════════════════════════════════════════╗"
        echo "║  ✅ Fix Applied Successfully!         ║"
        echo "╚════════════════════════════════════════╝"
        echo ""
        echo "📊 Services running:"
        docker-compose ps
        echo ""
        echo "⏭️  Next steps:"
        echo "  1. npm install --omit=optional"
        echo "  2. npm start (in new terminal)"
        echo "  3. npm run cli (in another terminal)"
        echo ""
    else
        echo ""
        echo "❌ Failed to start services"
        echo "Check logs: docker-compose logs"
    fi
else
    echo ""
    echo "❌ Build failed"
    echo ""
    echo "Check the error above and try:"
    echo "  docker-compose logs bullmq-metrics"
fi
