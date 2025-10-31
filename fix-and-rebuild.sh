#!/bin/bash

echo "🔧 Fixing npm install issues..."
echo ""

# Stop current Docker build
echo "📦 Stopping current Docker services..."
docker-compose down

# Clean up any partial builds
echo "🧹 Cleaning up..."
docker-compose rm -f
docker system prune -f

echo ""
echo "✅ Ready to restart!"
echo ""
echo "The following fixes have been applied:"
echo "  ✓ Removed Express dependency (using native http module)"
echo "  ✓ Pinned exact package versions"
echo "  ✓ Added --omit=optional flag to skip platform-specific packages"
echo ""
echo "🚀 Now run setup again:"
echo "   ./setup-tcad.sh"
echo ""
