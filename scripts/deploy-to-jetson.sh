#!/bin/bash

# Complete Remote Deployment Script for Jetson Nano Orin
# Run this from your Mac to deploy everything to the Jetson device

set -e

# Configuration
JETSON_IP="192.168.1.108"
JETSON_USER="nvidia"
PROJECT_DIR="mcp-voice-agent"

echo "🚀 MCP Voice Agent - Remote Jetson Deployment"
echo "=============================================="
echo "Target: ${JETSON_USER}@${JETSON_IP}"
echo ""

# Function to run commands on Jetson
run_remote() {
    ssh ${JETSON_USER}@${JETSON_IP} "$1"
}

# Function to check if command succeeded
check_command() {
    if [ $? -eq 0 ]; then
        echo "✅ $1"
    else
        echo "❌ $1 failed"
        exit 1
    fi
}

# Step 1: Test SSH connectivity
echo "🔌 Testing SSH connectivity..."
run_remote "whoami && echo 'SSH connection successful'"
check_command "SSH connectivity"

# Step 2: Transfer project files (excluding node_modules)
echo ""
echo "📦 Transferring project files..."
rsync -av --delete \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='logs' \
    --exclude='.git' \
    --exclude='uploads' \
    --exclude='*.log' \
    --exclude='.env' \
    . ${JETSON_USER}@${JETSON_IP}:~/${PROJECT_DIR}/
check_command "File transfer"

# Step 3: Create environment file
echo ""
echo "🔧 Setting up environment..."
if [ -f ".env" ]; then
    echo "Transferring local .env file..."
    scp .env ${JETSON_USER}@${JETSON_IP}:~/${PROJECT_DIR}/.env
else
    echo "Creating basic .env file (you'll need to add API keys)..."
    run_remote "cd ~/${PROJECT_DIR} && cat > .env << 'EOF'
# Add your API keys here
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
LLM_PROVIDER=openai
PORT=3000
NODE_ENV=production
EOF"
fi
check_command "Environment setup"

# Step 4: Stop existing deployment
echo ""
echo "🛑 Stopping existing deployment..."
run_remote "cd ~/${PROJECT_DIR} && docker compose down || true"
echo "✅ Existing containers stopped"

# Step 5: Check system requirements
echo ""
echo "🔍 Checking system requirements..."
run_remote "docker --version && echo 'Docker: OK'" || {
    echo "❌ Docker not found. Installing basic tools and Docker..."
    run_remote "sudo apt update && sudo apt install -y curl"
    run_remote "curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh"
    run_remote "sudo usermod -aG docker ${JETSON_USER}"
    run_remote "sudo apt install -y docker-compose-plugin"
    echo "⚠️  Docker installed. Installing NVIDIA Container Toolkit..."
    run_remote "distribution=\$(. /etc/os-release;echo \$ID\$VERSION_ID) && \
                curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg && \
                curl -s -L https://nvidia.github.io/libnvidia-container/\$distribution/libnvidia-container.list | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list && \
                sudo apt update && sudo apt install -y nvidia-container-toolkit"
    run_remote "sudo nvidia-ctk runtime configure --runtime=docker && sudo systemctl restart docker"
    echo "✅ Docker and NVIDIA Container Toolkit installed"
}

run_remote "nvidia-smi --query-gpu=name,memory.total --format=csv,noheader && echo 'NVIDIA GPU: OK'" || {
    echo "⚠️  NVIDIA GPU not detected or drivers not installed"
}

# Step 6: Deploy with GPU detection
echo ""
echo "🚀 Deploying with GPU auto-detection..."
run_remote "cd ~/${PROJECT_DIR} && chmod +x scripts/deploy-with-gpu.sh && ./scripts/deploy-with-gpu.sh"
check_command "GPU deployment"

# Step 7: Wait for services to start
echo ""
echo "⏳ Waiting for services to start..."
sleep 15

# Step 8: Health checks
echo ""
echo "🏥 Running health checks..."

# Check if containers are running
CONTAINERS_RUNNING=$(run_remote "cd ~/${PROJECT_DIR} && docker compose ps --services --filter 'status=running' | wc -l")
if [ "$CONTAINERS_RUNNING" -gt 0 ]; then
    echo "✅ Containers are running"
else
    echo "❌ Containers failed to start"
    echo "📋 Container logs:"
    run_remote "cd ~/${PROJECT_DIR} && docker compose logs --tail=20"
    exit 1
fi

# Health check endpoint
if curl -f -s http://${JETSON_IP}:3000/health > /dev/null; then
    echo "✅ Application health check passed"
else
    echo "❌ Application health check failed"
    echo "📋 Application logs:"
    run_remote "cd ~/${PROJECT_DIR} && docker compose logs voice-agent --tail=20"
    exit 1
fi

# Step 9: Display status information
echo ""
echo "📊 Deployment Status"
echo "==================="

# Hardware status
echo "🖥️  Hardware Status:"
curl -s http://${JETSON_IP}:3000/api/hardware-status | python3 -m json.tool 2>/dev/null || echo "Could not fetch hardware status"

echo ""
echo "🎙️  STT Service Status:"
curl -s http://${JETSON_IP}:3000/api/stt-status | python3 -m json.tool 2>/dev/null || echo "Could not fetch STT status"

# Step 10: Display summary
echo ""
echo "🎉 Deployment Complete!"
echo "======================"
echo "Voice Agent URL: http://${JETSON_IP}:3000"
echo ""
echo "🔗 Available Endpoints:"
echo "• Health: curl http://${JETSON_IP}:3000/health"
echo "• Hardware: curl http://${JETSON_IP}:3000/api/hardware-status"
echo "• STT Status: curl http://${JETSON_IP}:3000/api/stt-status"
echo "• Audio: curl -F 'audio=@file.wav' http://${JETSON_IP}:3000/api/audio"
echo "• Text: curl -H 'Content-Type: application/json' -d '{\"text\":\"test\"}' http://${JETSON_IP}:3000/api/text"
echo ""
echo "📋 Management Commands (run on Jetson):"
echo "• View logs: ssh ${JETSON_USER}@${JETSON_IP} 'cd ${PROJECT_DIR} && docker compose logs -f'"
echo "• Restart: ssh ${JETSON_USER}@${JETSON_IP} 'cd ${PROJECT_DIR} && docker compose restart'"
echo "• Stop: ssh ${JETSON_USER}@${JETSON_IP} 'cd ${PROJECT_DIR} && docker compose down'"
echo ""

# Step 11: Quick test
echo "🧪 Quick Test:"
echo "curl -H 'Content-Type: application/json' -d '{\"text\":\"Hello, are you working?\"}' http://${JETSON_IP}:3000/api/text"

echo ""
echo "✨ Ready to use!"

# Optional: Run a quick test
if [ "${1:-}" = "--test" ]; then
    echo ""
    echo "🧪 Running quick test..."
    curl -H 'Content-Type: application/json' -d '{"text":"Hello, test message"}' http://${JETSON_IP}:3000/api/text
fi 