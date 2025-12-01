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

# Check Docker permissions
USE_SUDO=""
if ! docker ps &> /dev/null; then
    echo "⚠️  Docker permission issue detected"

    # Check if user is in docker group
    if ! groups | grep -q docker; then
        echo "📝 Adding user to docker group..."
        sudo usermod -aG docker $USER
        echo "✅ User added to docker group"
        echo "⚠️  Note: You'll need to log out and back in for this to take permanent effect"
        echo ""
    fi

    echo "🔑 Using sudo for this session..."
    USE_SUDO="sudo"
fi

# Step 1: Clean up existing containers
echo "🧹 Step 1: Cleaning up any existing containers..."
$USE_SUDO docker-compose down 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Cleaned up existing containers"
else
    echo "ℹ️  No existing containers to clean up"
fi
echo ""

# Step 2: Start monitoring stack
echo "📦 Step 2: Starting monitoring stack (Redis, Prometheus, PostgreSQL)..."
$USE_SUDO docker-compose up -d

if [ $? -ne 0 ]; then
    echo "❌ Failed to start monitoring stack"
    echo ""
    echo "💡 Debug tips:"
    echo "   - Check logs: ${USE_SUDO} docker-compose logs"
    echo "   - Check status: ${USE_SUDO} docker-compose ps"
    exit 1
fi

echo "✅ Monitoring stack started"
echo ""

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Step 3: Verify services are running
echo "🔍 Step 3: Verifying services..."
$USE_SUDO docker-compose ps --format json > /dev/null 2>&1 || $USE_SUDO docker-compose ps

# Test Redis connection
if $USE_SUDO docker exec bullmq-redis redis-cli ping &> /dev/null; then
    echo "✅ Redis is responding"
else
    echo "⚠️  Redis might not be ready yet (this is usually okay)"
fi

# Test Prometheus
if curl -s http://localhost:9090/-/healthy > /dev/null 2>&1; then
    echo "✅ Prometheus is healthy"
else
    echo "⚠️  Prometheus might not be ready yet (this is usually okay)"
fi

# Test metrics endpoint
if curl -s http://localhost:3000/metrics > /dev/null 2>&1; then
    echo "✅ Metrics exporter is responding"
else
    echo "⚠️  Metrics exporter might not be ready yet (this is usually okay)"
fi

echo ""

# Step 4: Install Node.js dependencies (if needed)
echo "📦 Step 4: Checking Node.js dependencies..."
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
    echo "Installing Node.js dependencies..."
    npm install --omit=optional

    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
    echo "✅ Dependencies installed"
else
    echo "✅ Dependencies already installed"
fi
echo ""

# Step 5: Make scripts executable
echo "🔧 Step 5: Making scripts executable..."
chmod +x tcad-cli.js start.sh 2>/dev/null

echo "✅ Scripts ready"
echo ""

# Display success message
echo "╔═══════════════════════════════════════════════════════╗"
echo "║           🎉 Setup Complete! 🎉                       ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""
echo "🌐 Services:"
echo "   - Prometheus:  http://localhost:9090"
echo "   - Metrics:     http://localhost:3000/metrics"
echo "   - Redis:       localhost:6379"
echo "   - PostgreSQL:  localhost:5432"
echo ""

# Show sudo note if needed
if [ ! -z "$USE_SUDO" ]; then
    echo "⚠️  Note: Docker commands currently require sudo"
    echo "   To avoid this, log out and log back in (or run: newgrp docker)"
    echo "   Then docker-compose commands will work without sudo"
    echo ""
fi

echo "🚀 Next Steps:"
echo ""
echo "1. Start the worker:"
echo "   npm start"
echo ""
echo "2. In a new terminal, use the CLI to add jobs:"
echo "   ./tcad-cli.js"
echo "   or: npm run cli"
echo ""
echo "3. Or run a test:"
echo "   npm test"
echo ""
echo "4. View the dashboard:"
echo "   Open http://localhost:5050 and navigate to:"
echo "   Dashboards → BullMQ Queue Monitoring"
echo ""
echo "💡 Useful Commands:"
echo "   - Check services:  ${USE_SUDO} docker-compose ps"
echo "   - View logs:       ${USE_SUDO} docker-compose logs -f"
echo "   - Stop services:   ${USE_SUDO} docker-compose down"
echo "   - Restart:         ${USE_SUDO} docker-compose restart"
echo ""
echo "📖 Read TCAD-README.md for full documentation"
echo ""
