#!/bin/bash

# Local setup script for Jetson Nano Orin
# Run this script directly on the Jetson device

set -e

echo "🚀 Jetson Local Setup - Installing Docker & Dependencies"
echo "======================================================="
echo "Running on: $(uname -a)"
echo ""

# Check if we're on the Jetson
if [ -f /proc/device-tree/model ]; then
    MODEL=$(cat /proc/device-tree/model 2>/dev/null || echo "unknown")
    echo "🎯 Device: $MODEL"
else
    echo "⚠️  Device model unknown"
fi

echo ""
echo "📋 Current system status:"
echo "• Docker: $(which docker 2>/dev/null || echo 'Not installed')"
echo "• NVIDIA GPU: $(which nvidia-smi 2>/dev/null || echo 'Not found')"
echo "• User groups: $(groups)"

echo ""
echo "🔄 Step 1: Update system packages..."
sudo apt update

echo ""
echo "📦 Step 2: Install basic tools..."
sudo apt install -y curl wget git nano htop

echo ""
echo "🐳 Step 3: Install Docker..."
if command -v docker >/dev/null 2>&1; then
    echo "✅ Docker already installed: $(docker --version)"
else
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    echo "✅ Docker installed"
fi

echo ""
echo "👥 Step 4: Add user to docker group..."
sudo usermod -aG docker $USER

echo ""
echo "🔧 Step 5: Install Docker Compose..."
sudo apt install -y docker-compose-plugin

echo ""
echo "🚀 Step 6: Install NVIDIA Container Toolkit..."
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
   sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
   sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt update
sudo apt install -y nvidia-container-toolkit

echo ""
echo "⚙️  Step 7: Configure Docker for NVIDIA..."
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

echo ""
echo "🧪 Step 8: Test installations..."
echo "Docker version:"
docker --version

echo ""
echo "Docker Compose version:"
docker compose version

echo ""
echo "NVIDIA GPU status:"
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader

echo ""
echo "🔥 Step 9: Test Docker + NVIDIA integration..."
echo "Testing GPU access in Docker container..."

# Apply group changes for current session
newgrp docker << 'EOF'
if docker run --rm --gpus all nvidia/cuda:12.4.0-base-ubuntu22.04 nvidia-smi; then
    echo "✅ Docker + NVIDIA GPU integration working!"
    exit 0
else
    echo "❌ Docker + NVIDIA GPU test failed"
    exit 1
fi
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Setup Complete!"
    echo "=================="
    echo "✅ Docker installed and working"
    echo "✅ NVIDIA Container Toolkit installed"
    echo "✅ GPU access verified"
    echo ""
    echo "🚀 Next step: Deploy the voice agent"
    echo "   From your Mac, run: ./scripts/deploy-to-jetson.sh"
    echo ""
    echo "⚠️  NOTE: You may need to log out and back in for group changes to take full effect"
else
    echo ""
    echo "⚠️  Setup completed but GPU test failed"
    echo "   Try logging out and back in, then test again with:"
    echo "   docker run --rm --gpus all nvidia/cuda:12.4.0-base-ubuntu22.04 nvidia-smi"
fi 