#!/bin/bash

set -e

JETSON_HOST=${1:-"192.168.1.108"}
JETSON_USER="nvidia"
PROJECT_NAME="mcp-voice-agent"

echo "🚀 MCP Voice Agent - Native Jetson Deployment"
echo "=============================================="
echo "Target: ${JETSON_USER}@${JETSON_HOST}"
echo ""

# Test SSH connectivity
echo "🔌 Testing SSH connectivity..."
if ssh -o ConnectTimeout=10 ${JETSON_USER}@${JETSON_HOST} 'echo $(whoami)'; then
    echo "✅ SSH connectivity"
else
    echo "❌ SSH connection failed"
    exit 1
fi

# Transfer project files
echo ""
echo "📦 Transferring project files..."
rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'logs' \
    --exclude 'uploads' \
    --exclude 'docker-compose.yml' \
    --exclude 'Dockerfile' \
    --exclude '*.log' \
    --exclude 'dist' \
    --exclude 'build' \
    ./ ${JETSON_USER}@${JETSON_HOST}:~/${PROJECT_NAME}/

echo "✅ File transfer"

# Transfer environment file
echo ""
echo "🔧 Setting up environment..."
if [ -f .env ]; then
    scp .env ${JETSON_USER}@${JETSON_HOST}:~/${PROJECT_NAME}/
    echo "✅ Environment setup"
else
    echo "⚠️  No .env file found locally"
fi

# Install dependencies and setup on Jetson
echo ""
echo "🛠️  Installing dependencies on Jetson..."
ssh ${JETSON_USER}@${JETSON_HOST} << 'EOF'
set -e

cd ~/mcp-voice-agent

echo "📋 System setup..."

# Update system packages
sudo apt update

# Install Node.js 20 if not present
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'v' -f2 | cut -d'.' -f1) -lt 20 ]]; then
    echo "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install Python packages for GPU
echo "🐍 Installing Python ML packages with GPU support..."
pip3 install --user torch torchvision torchaudio
pip3 install --user openai-whisper transformers
pip3 install --user onnxruntime

# Install PM2 globally if not present
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2
fi

# Install project dependencies
echo "📦 Installing Node.js dependencies..."
npm ci

# Install voice-agent dependencies
cd voice-agent
npm ci
cd ..

# Install MCP server dependencies
cd mcp-servers/finance-mcp
npm ci
cd ../dev-tools-mcp
npm ci
cd ../..

# Build TypeScript projects
echo "🔨 Building TypeScript projects..."
cd voice-agent && npm run build && cd ..
cd mcp-servers/finance-mcp && npm run build && cd ..
cd mcp-servers/dev-tools-mcp && npm run build && cd ../..

# Create directories
mkdir -p data logs uploads

echo "✅ Dependencies installed"
EOF

echo "✅ Dependencies installation complete"

# Create PM2 ecosystem config for native deployment
echo ""
echo "⚙️  Creating PM2 configuration..."
ssh ${JETSON_USER}@${JETSON_HOST} << 'EOF'
cd ~/mcp-voice-agent

cat > ecosystem-native.config.js << 'EOC'
module.exports = {
  apps: [
    {
      name: 'mcp-voice-agent',
      script: 'voice-agent/dist/index.js',
      cwd: '/home/nvidia/mcp-voice-agent',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        LLM_PROVIDER: 'openai',
        STT_PREFER_LOCAL: 'true',
        PORT: '3000'
      },
      log_file: './logs/voice-agent.log',
      out_file: './logs/voice-agent-out.log',
      error_file: './logs/voice-agent-error.log',
      max_memory_restart: '1G',
      restart_delay: 4000
    },
    {
      name: 'finance-api',
      script: 'mcp-servers/finance-mcp/dist/http-server.js',
      cwd: '/home/nvidia/mcp-voice-agent',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: '3001'
      },
      log_file: './logs/finance-api.log',
      out_file: './logs/finance-api-out.log',
      error_file: './logs/finance-api-error.log',
      max_memory_restart: '512M'
    },
    {
      name: 'dev-tools-api',
      script: 'mcp-servers/dev-tools-mcp/dist/http-server.js',
      cwd: '/home/nvidia/mcp-voice-agent',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: '3002'
      },
      log_file: './logs/dev-tools-api.log',
      out_file: './logs/dev-tools-api-out.log',
      error_file: './logs/dev-tools-api-error.log',
      max_memory_restart: '512M'
    }
  ]
};
EOC

echo "✅ PM2 configuration created"
EOF

# Stop any existing Docker containers and PM2 processes
echo ""
echo "🛑 Stopping existing services..."
ssh ${JETSON_USER}@${JETSON_HOST} << 'EOF'
cd ~/mcp-voice-agent

# Stop Docker containers if running
if command -v docker &> /dev/null && [ -f docker-compose.yml ]; then
    echo "Stopping Docker containers..."
    docker compose down 2>/dev/null || true
fi

# Stop existing PM2 processes
pm2 delete all 2>/dev/null || true

echo "🔄 Starting native services..."

# Start new processes
pm2 start ecosystem-native.config.js

# Save PM2 config
pm2 save

# Setup PM2 startup (run on boot)
pm2 startup systemd -u nvidia --hp /home/nvidia

echo "✅ Services started"
EOF

# Test GPU acceleration
echo ""
echo "🧪 Testing GPU acceleration..."
ssh ${JETSON_USER}@${JETSON_HOST} << 'EOF'
cd ~/mcp-voice-agent

echo "Testing PyTorch CUDA availability..."
python3 -c "
import torch
print(f'PyTorch version: {torch.__version__}')
print(f'CUDA available: {torch.cuda.is_available()}')
if torch.cuda.is_available():
    print(f'CUDA version: {torch.version.cuda}')
    print(f'GPU count: {torch.cuda.device_count()}')
    print(f'GPU name: {torch.cuda.get_device_name(0)}')
else:
    print('CUDA not available - will use CPU')
"
EOF

# Health check
sleep 5
echo ""
echo "🏥 Running health checks..."
if curl -s http://${JETSON_HOST}:3000/health > /dev/null; then
    echo "✅ Voice Agent health check passed"
else
    echo "❌ Voice Agent health check failed"
fi

# Display status
echo ""
echo "📊 Deployment Status"
echo "==================="
ssh ${JETSON_USER}@${JETSON_HOST} 'cd ~/mcp-voice-agent && pm2 status'

echo ""
echo "🎉 Native Deployment Complete!"
echo "=============================="
echo "Voice Agent URL: http://${JETSON_HOST}:3000"
echo ""
echo "🔗 Available Endpoints:"
echo "• Health: curl http://${JETSON_HOST}:3000/health"
echo "• Hardware: curl http://${JETSON_HOST}:3000/api/hardware-status"
echo "• STT Status: curl http://${JETSON_HOST}:3000/api/stt-status"
echo "• Audio: curl -F 'audio=@file.wav' http://${JETSON_HOST}:3000/api/audio"
echo "• Text: curl -H 'Content-Type: application/json' -d '{\"text\":\"test\"}' http://${JETSON_HOST}:3000/api/text"
echo ""
echo "📋 Management Commands (run on Jetson):"
echo "• View logs: ssh ${JETSON_USER}@${JETSON_HOST} 'cd mcp-voice-agent && pm2 logs'"
echo "• Restart: ssh ${JETSON_USER}@${JETSON_HOST} 'cd mcp-voice-agent && pm2 restart all'"
echo "• Stop: ssh ${JETSON_USER}@${JETSON_HOST} 'cd mcp-voice-agent && pm2 stop all'"
echo "• Status: ssh ${JETSON_USER}@${JETSON_HOST} 'cd mcp-voice-agent && pm2 status'"
echo ""
echo "🧪 Quick Test:"
echo "curl -H 'Content-Type: application/json' -d '{\"text\":\"Hello, are you working?\"}' http://${JETSON_HOST}:3000/api/text"
echo ""
echo "✨ Ready to use with native GPU acceleration!" 