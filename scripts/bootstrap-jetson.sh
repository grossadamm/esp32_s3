#!/bin/bash

# Bootstrap script for fresh Jetson Nano Orin setup
# Installs Docker, NVIDIA Container Toolkit, and dependencies

set -e

JETSON_IP="192.168.1.108"
JETSON_USER="nvidia"

echo "🛠️  Jetson Bootstrap - Installing Dependencies"
echo "=============================================="
echo "Target: ${JETSON_USER}@${JETSON_IP}"
echo ""

# Function to run commands on Jetson
run_remote() {
    ssh ${JETSON_USER}@${JETSON_IP} "$1"
}

echo "🔌 Testing SSH connectivity..."
run_remote "whoami && echo 'SSH connection successful'"

echo ""
echo "📋 System Information:"
run_remote "uname -a"
run_remote "cat /etc/os-release | head -3"

echo ""
echo "💾 Updating system packages..."
run_remote "sudo apt update"

echo ""
echo "📦 Installing basic tools..."
run_remote "sudo apt install -y curl wget git nano htop"

echo ""
echo "🐳 Installing Docker..."
run_remote "curl -fsSL https://get.docker.com -o get-docker.sh"
run_remote "sudo sh get-docker.sh"
run_remote "sudo usermod -aG docker ${JETSON_USER}"

echo ""
echo "🔧 Installing Docker Compose..."
run_remote "sudo apt install -y docker-compose-plugin"

echo ""
echo "🚀 Installing NVIDIA Container Toolkit..."
run_remote "distribution=\$(. /etc/os-release;echo \$ID\$VERSION_ID)"
run_remote "curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg"
run_remote "curl -s -L https://nvidia.github.io/libnvidia-container/\$distribution/libnvidia-container.list | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list"
run_remote "sudo apt update"
run_remote "sudo apt install -y nvidia-container-toolkit"

echo ""
echo "⚙️  Configuring Docker for NVIDIA..."
run_remote "sudo nvidia-ctk runtime configure --runtime=docker"
run_remote "sudo systemctl restart docker"

echo ""
echo "🧪 Testing Docker installation..."
run_remote "docker --version"
run_remote "docker compose version"

echo ""
echo "🎯 Testing NVIDIA GPU access..."
run_remote "nvidia-smi"

echo ""
echo "🔥 Testing Docker + NVIDIA integration..."
if run_remote "docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi" 2>/dev/null; then
    echo "✅ Docker + NVIDIA GPU integration working!"
else
    echo "⚠️  Docker + NVIDIA GPU integration test failed"
    echo "   This might work after a reboot or re-login"
fi

echo ""
echo "🎉 Bootstrap Complete!"
echo "===================="
echo "✅ Docker installed and configured"
echo "✅ NVIDIA Container Toolkit installed"
echo "✅ Basic tools installed"
echo ""
echo "⚠️  IMPORTANT: You may need to log out and back in for Docker group changes to take effect."
echo ""
echo "Next step: Run Docker deployment:"
echo "  docker compose up --build -d" 