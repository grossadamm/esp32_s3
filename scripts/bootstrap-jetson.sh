#!/bin/bash

# Local Bootstrap script for Jetson Nano Orin
# Run this directly ON the Jetson (not via SSH)
# Installs Node.js, Docker updates, and build tools

set -e

echo "🛠️  Jetson Local Bootstrap - Installing Dependencies"
echo "=================================================="
echo "Running directly on: $(hostname)"
echo ""

echo "📋 System Information:"
uname -a
cat /etc/os-release | head -3

echo ""
echo "💾 Updating system packages..."
sudo apt update

echo ""
echo "📦 Installing basic tools..."
sudo apt install -y curl wget git nano htop build-essential

echo ""
echo "🟢 Installing Node.js 18 LTS..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

echo ""
echo "🐳 Updating Docker configuration..."
# Docker is already installed, just ensure it's properly configured
sudo usermod -aG docker $USER

echo ""
echo "🔧 Updating Docker Compose..."
sudo apt install -y docker-compose-plugin

echo ""
echo "🚀 Updating NVIDIA Container Toolkit..."
# May already be installed, but ensure it's latest version
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt update
sudo apt install -y nvidia-container-toolkit

echo ""
echo "⚙️  Configuring Docker for NVIDIA..."
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

echo ""
echo "🧪 Testing installations..."
echo "Node.js version:"
node --version
echo "npm version:"
npm --version
echo "Docker version:"
docker --version
echo "Docker Compose version:"
docker compose version

echo ""
echo "🎯 Testing NVIDIA GPU access..."
nvidia-smi

echo ""
echo "🔥 Testing Docker + NVIDIA integration..."
if docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi 2>/dev/null; then
    echo "✅ Docker + NVIDIA GPU integration working!"
else
    echo "⚠️  Docker + NVIDIA GPU integration test failed"
    echo "   This might work after a reboot or re-login"
fi

echo ""
echo "🎉 Local Bootstrap Complete!"
echo "=========================="
echo "✅ Node.js 18 LTS installed"
echo "✅ Docker updated and configured"
echo "✅ NVIDIA Container Toolkit updated"
echo "✅ Basic tools installed"
echo ""
echo "⚠️  IMPORTANT: You may need to log out and back in for Docker group changes to take effect."
echo ""
echo "Next steps:"
echo "1. Exit SSH and run voice agent setup from your Mac:"
echo "   ./scripts/setup-jetson-gpu.sh"
echo ""
echo "2. Or run traditional Docker deployment:"
echo "   docker compose up --build -d" 