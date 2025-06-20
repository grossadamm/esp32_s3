#!/bin/bash

# Development Docker setup for macOS
# This uses docker-compose.dev.yml which disables GPU support for macOS compatibility

echo "🖥️  Starting MCP Voice Agent in development mode (macOS compatible)..."
echo "📱 Mobile UI will be available at: http://localhost:3000/"
echo ""

# Stop any existing containers first
docker compose -f docker-compose.dev.yml down 2>/dev/null

# Start development containers
docker compose -f docker-compose.dev.yml up --build -d

echo ""
echo "✅ Services started!"
echo ""
echo "📱 Mobile UI: http://localhost:3000/"
echo "📊 Health check: http://localhost:3000/health"
echo ""
echo "🔍 View logs:"
echo "   docker compose -f docker-compose.dev.yml logs -f"
echo ""
echo "🛑 Stop services:"
echo "   docker compose -f docker-compose.dev.yml down" 