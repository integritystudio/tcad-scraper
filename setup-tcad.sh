#!/bin/bash

echo "🏠 TCAD Scraper Setup"
echo "====================="
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

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Step 1: Start monitoring stack
echo "📦 Step 1: Starting monitoring stack (Redis, Prometheus, Grafana)..."
docker-compose up -d

if [ $? -ne 0 ]; then
    echo "❌ Failed to start monitoring stack"
    exit 1
fi

echo "✅ Monitoring stack started"
echo ""

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Step 2: Install Node.js dependencies
echo "📦 Step 2: Installing Node.js dependencies..."
cp tcad-package.json package.json
npm install --omit=optional

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed"
echo ""

# Step 3: Make scripts executable
echo "🔧 Step 3: Making scripts executable..."
chmod +x tcad-cli.js
chmod +x start.sh

echo "✅ Scripts ready"
echo ""

# Display success message
echo "╔═══════════════════════════════════════════════════════╗"
echo "║           🎉 Setup Complete! 🎉                       ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""
echo "🌐 Services:"
echo "   - Grafana:     http://localhost:3001 (admin/admin)"
echo "   - Prometheus:  http://localhost:9090"
echo "   - Metrics:     http://localhost:3000/metrics"
echo "   - Redis:       localhost:6379"
echo ""
echo "🚀 Next Steps:"
echo ""
echo "1. Start the worker:"
echo "   npm start"
echo ""
echo "2. In a new terminal, use the CLI to add jobs:"
echo "   npm run cli"
echo ""
echo "3. Or run a test:"
echo "   npm test"
echo ""
echo "4. View the dashboard:"
echo "   Open http://localhost:3001 and navigate to:"
echo "   Dashboards → BullMQ Queue Monitoring"
echo ""
echo "📖 Read TCAD-README.md for full documentation"
echo ""
