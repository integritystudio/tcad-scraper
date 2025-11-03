#!/bin/bash

echo "🚀 Starting BullMQ Monitoring Stack..."
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Start the stack
echo "📦 Starting services..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

echo ""
echo "✅ Services are running!"
echo ""
echo "🌐 Access URLs:"
echo "   Prometheus:  http://localhost:9090"
echo "   Metrics:     http://localhost:3000/metrics"
echo "   Redis:       localhost:6379"
echo ""
echo "📊 To view the BullMQ dashboard:"
echo "   Visit the Bull Board dashboard (available when server is running)"
echo ""
echo "🧪 To run the example application:"
echo "   npm install bullmq"
echo "   node example-app.js"
echo ""
echo "📝 Check logs:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 To stop:"
echo "   docker-compose down"
echo ""
