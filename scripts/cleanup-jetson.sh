#!/bin/bash

# Jetson Orin Cleanup Script - Remove old deployments and free up space
set -e

JETSON_IP=${1:-"192.168.1.108"}
JETSON_USER="nvidia"

echo "🧹 Jetson Orin Cleanup"
echo "====================="
echo "Target: ${JETSON_USER}@${JETSON_IP}"
echo "This will clean up old containers, images, and files"
echo ""

# Confirm cleanup
read -p "⚠️  This will stop all containers and remove old data. Continue? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""
echo "🔌 Testing SSH connectivity..."
if ! ssh -o ConnectTimeout=10 ${JETSON_USER}@${JETSON_IP} 'echo "Connected"' >/dev/null 2>&1; then
    echo "❌ SSH connection failed"
    exit 1
fi
echo "✅ SSH connectivity"

echo ""
echo "🧹 Starting cleanup on Jetson..."

ssh ${JETSON_USER}@${JETSON_IP} << 'EOF'
set -e

echo "📊 Current system status:"
echo "========================"
echo "Disk usage before cleanup:"
df -h / | grep -E "(Filesystem|/dev/)"
echo ""
echo "Docker images before cleanup:"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | head -10
echo ""

echo "🛑 Stopping all running services..."
echo "==================================="

# Stop all Docker containers
echo "Stopping all Docker containers..."
docker stop $(docker ps -aq) 2>/dev/null || echo "No containers to stop"

# Stop Docker Compose services
echo "Stopping Docker Compose services..."
cd ~/voice-agent 2>/dev/null || cd ~ || true
docker compose down 2>/dev/null || true
docker compose -f docker-compose.yml down 2>/dev/null || true
docker compose -f docker-compose.dev.yml down 2>/dev/null || true
docker compose -f docker-compose.jetson.yml down 2>/dev/null || true

# Kill native Node.js processes
echo "Stopping native Node.js processes..."
pkill -f "node.*voice-agent" 2>/dev/null || true
pkill -f "node.*mcp-server" 2>/dev/null || true

# Stop PM2 processes
echo "Stopping PM2 processes..."
pm2 delete all 2>/dev/null || true
pm2 kill 2>/dev/null || true

echo "✅ All services stopped"

echo ""
echo "🗑️  Removing containers and images..."
echo "===================================="

# Remove all containers
echo "Removing all containers..."
docker rm -f $(docker ps -aq) 2>/dev/null || echo "No containers to remove"

# Remove MCP voice agent related images
echo "Removing MCP voice agent images..."
docker rmi $(docker images | grep -E "mcp-voice-agent|voice-agent" | awk '{print $3}') 2>/dev/null || echo "No MCP images to remove"

# Remove old/unused images (keep dusty-nv images)
echo "Removing dangling images..."
docker image prune -f

# Remove old Docker networks
echo "Removing unused networks..."
docker network prune -f

# Remove unused volumes
echo "Removing unused volumes..."
docker volume prune -f

echo "✅ Docker cleanup complete"

echo ""
echo "📁 Cleaning up old files..."
echo "=========================="

# Clean up old deployment directories
echo "Removing old voice-agent directory..."
rm -rf ~/voice-agent/logs/* 2>/dev/null || true
rm -rf ~/voice-agent/uploads/* 2>/dev/null || true
rm -rf ~/voice-agent/node_modules 2>/dev/null || true
rm -rf ~/voice-agent/voice-agent/node_modules 2>/dev/null || true
rm -rf ~/voice-agent/mcp-servers/*/node_modules 2>/dev/null || true
rm -rf ~/voice-agent/voice-agent/dist 2>/dev/null || true
rm -rf ~/voice-agent/mcp-servers/*/dist 2>/dev/null || true

# Remove PID files
rm -f ~/voice-agent/*.pid 2>/dev/null || true

# Remove temporary GPU wrapper script
rm -f ~/voice-agent/gpu-whisper-stt.py 2>/dev/null || true

echo "✅ File cleanup complete"

echo ""
echo "🐍 Cleaning up Python packages..."
echo "================================"

# Remove user-installed ML packages (we'll use container versions)
pip3 uninstall -y torch torchvision torchaudio 2>/dev/null || true
pip3 uninstall -y openai-whisper transformers 2>/dev/null || true
pip3 uninstall -y onnxruntime 2>/dev/null || true

echo "✅ Python cleanup complete"

echo ""
echo "🔧 System cleanup..."
echo "==================="

# Clear package cache
sudo apt autoremove -y 2>/dev/null || true
sudo apt autoclean 2>/dev/null || true

# Clear pip cache
pip3 cache purge 2>/dev/null || true

# Clear npm cache
npm cache clean --force 2>/dev/null || true

# Clear Docker system (more aggressive)
echo "Running aggressive Docker cleanup..."
docker system prune -a -f --volumes

echo "✅ System cleanup complete"

echo ""
echo "📊 Cleanup results:"
echo "=================="
echo "Disk usage after cleanup:"
df -h / | grep -E "(Filesystem|/dev/)"
echo ""
echo "Remaining Docker images:"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | head -10
echo ""
echo "Running containers (should be none):"
docker ps || echo "No running containers"
echo ""
echo "Available memory:"
free -h | head -2

echo ""
echo "🎯 Verification..."
echo "================="

# Check critical services are stopped
if pgrep -f "voice-agent" >/dev/null; then
    echo "⚠️  Some voice-agent processes still running"
    ps aux | grep voice-agent | grep -v grep
else
    echo "✅ No voice-agent processes running"
fi

# Check Docker is clean
if [ $(docker ps -q | wc -l) -eq 0 ]; then
    echo "✅ No Docker containers running"
else
    echo "⚠️  Some Docker containers still running:"
    docker ps
fi

# Check disk space
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -lt 80 ]; then
    echo "✅ Disk usage looks good: ${DISK_USAGE}%"
else
    echo "⚠️  Disk usage still high: ${DISK_USAGE}%"
fi

echo ""
echo "🎉 Cleanup Complete!"
echo "==================="
echo "✅ All old services stopped"
echo "✅ Containers and images removed"
echo "✅ Old files cleaned up"
echo "✅ System caches cleared"
echo "✅ Ready for fresh deployment"

EOF

# Final verification from local machine
echo ""
echo "🔍 Final verification..."
echo "======================="

echo "Testing Jetson accessibility..."
if curl -s http://${JETSON_IP}:3000/health 2>/dev/null; then
    echo "⚠️  Voice agent still responding (unexpected)"
else
    echo "✅ Voice agent properly stopped"
fi

echo ""
echo "📋 Post-cleanup summary:"
ssh ${JETSON_USER}@${JETSON_IP} 'echo "• Disk usage: $(df -h / | tail -1 | awk "{print \$5}")" && echo "• Docker images: $(docker images -q | wc -l)" && echo "• Running containers: $(docker ps -q | wc -l)" && echo "• Available memory: $(free -h | grep Mem | awk "{print \$7}")"'

echo ""
echo "🎉 Jetson Orin Cleanup Complete!"
echo "==============================="
echo ""
echo "The Jetson is now clean and ready for deployment:"
echo "• All old containers removed"
echo "• All old processes stopped" 
echo "• Disk space freed up"
echo "• System caches cleared"
echo ""
echo "Next step: Deploy using Docker Compose"
echo "docker compose up --build -d"

EOF 