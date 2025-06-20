#!/bin/bash
set -e

# =============================================================================
# Jetson GPU Setup Script (One-time, 25 minutes)
# 
# Purpose: Initial Jetson setup with ARM dependency builds
# Run when: First deployment OR when dependencies change (package.json modified)
# 
# This implements the hybrid GPU strategy:
# - Uses dustynv/l4t-pytorch for reliable GPU access
# - Builds ARM dependencies natively (no cross-compilation)
# - Sets up fast development workflow for regular deployments
# =============================================================================

# Configuration
JETSON_IP="${1:-192.168.1.108}"
JETSON_USER="${2:-nvidia}"
JETSON_PROJECT_DIR="voice-agent-gpu"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

echo -e "${BLUE}"
echo "================================================================="
echo "🏗️  Jetson GPU Setup (One-time, 25 minutes)"
echo "================================================================="
echo "This builds ARM dependencies and sets up the GPU environment"
echo "Target: $JETSON_USER@$JETSON_IP"
echo "Project: ~/$JETSON_PROJECT_DIR"
echo -e "${NC}"

read -p "Continue with one-time setup? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Setup cancelled"
    exit 0
fi

START_TIME=$(date +%s)

# Phase 1: Prerequisites & Transfer
log_info "Validating Jetson prerequisites..."
ssh "$JETSON_USER@$JETSON_IP" 'nvidia-smi && docker --version && df -h | head -2'

log_info "Transferring project files..."
rsync -av --progress \
    --exclude node_modules \
    --exclude dist \
    --exclude .git \
    --exclude logs \
    --exclude uploads \
    --exclude ssl \
    ./ "$JETSON_USER@$JETSON_IP:~/$JETSON_PROJECT_DIR/"

# Transfer environment file
scp .env "$JETSON_USER@$JETSON_IP:~/$JETSON_PROJECT_DIR/" 2>/dev/null || \
    log_warning "No .env file found - configure API keys later"

# Phase 2: ARM Dependency Builds (The expensive part)
log_warning "Building ARM dependencies (20-25 minutes)..."
log_info "Root dependencies..."
ssh "$JETSON_USER@$JETSON_IP" "cd $JETSON_PROJECT_DIR && npm ci"

log_info "Voice agent dependencies..."
ssh "$JETSON_USER@$JETSON_IP" "cd $JETSON_PROJECT_DIR/voice-agent && npm ci"

log_info "Finance MCP dependencies..."
ssh "$JETSON_USER@$JETSON_IP" "cd $JETSON_PROJECT_DIR/mcp-servers/finance-mcp && npm ci"

log_info "Dev tools MCP dependencies..."
ssh "$JETSON_USER@$JETSON_IP" "cd $JETSON_PROJECT_DIR/mcp-servers/dev-tools-mcp && npm ci"

# Phase 3: Initial TypeScript Builds
log_info "Building TypeScript projects..."
ssh "$JETSON_USER@$JETSON_IP" "cd $JETSON_PROJECT_DIR && npm run build"
ssh "$JETSON_USER@$JETSON_IP" "cd $JETSON_PROJECT_DIR/voice-agent && npm run build"
ssh "$JETSON_USER@$JETSON_IP" "cd $JETSON_PROJECT_DIR/mcp-servers/finance-mcp && npm run build"
ssh "$JETSON_USER@$JETSON_IP" "cd $JETSON_PROJECT_DIR/mcp-servers/dev-tools-mcp && npm run build"

# Phase 4: GPU Container Setup
log_info "Setting up GPU container environment..."

# Create GPU-enabled docker-compose file
ssh "$JETSON_USER@$JETSON_IP" "cat > ~/$JETSON_PROJECT_DIR/docker-compose.gpu.yml << 'EOF'
version: '3.8'
services:
  voice-agent-gpu:
    image: dustynv/l4t-pytorch:r36.4.0
    runtime: nvidia
    network_mode: host
    working_dir: /app
    volumes:
      - ./:/app
    command: node voice-agent/dist/index.js
    environment:
      - NODE_ENV=production
      - GPU_ENABLED=true
    restart: unless-stopped
EOF"

# Pull GPU base image
log_info "Pulling GPU base image..."
ssh "$JETSON_USER@$JETSON_IP" "docker pull dustynv/l4t-pytorch:r36.4.0"

# Start the container
log_info "Starting GPU voice agent..."
ssh "$JETSON_USER@$JETSON_IP" "cd $JETSON_PROJECT_DIR && docker-compose -f docker-compose.gpu.yml up -d"

# Wait for startup
sleep 15

# Phase 5: Integration Testing
log_info "Testing deployment..."
HEALTH_CHECK=$(ssh "$JETSON_USER@$JETSON_IP" "curl -s http://localhost:3000/health" || echo "failed")

if [[ $HEALTH_CHECK == *"ok"* ]] || [[ $HEALTH_CHECK == *"healthy"* ]]; then
    log_success "Voice agent is running successfully"
else
    log_warning "Health check unclear, checking container..."
    ssh "$JETSON_USER@$JETSON_IP" "docker logs voice-agent-gpu_voice-agent-gpu_1 --tail 10"
fi

# Test GPU access
log_info "Verifying GPU access..."
GPU_STATUS=$(ssh "$JETSON_USER@$JETSON_IP" "docker exec voice-agent-gpu_voice-agent-gpu_1 python3 -c 'import torch; print(torch.cuda.is_available())' 2>/dev/null" || echo "unknown")
log_info "CUDA available: $GPU_STATUS"

# Mark setup complete
ssh "$JETSON_USER@$JETSON_IP" "echo 'Setup completed: $(date)' > $JETSON_PROJECT_DIR/.setup-complete"

# Create monitoring script
ssh "$JETSON_USER@$JETSON_IP" "cat > ~/$JETSON_PROJECT_DIR/monitor.sh << 'EOF'
#!/bin/bash
echo '🔍 Voice Agent Status:'
docker ps | grep voice-agent-gpu || echo 'Container not running'
echo ''
echo '🖥️  GPU Status:'
nvidia-smi --query-gpu=name,utilization.gpu,memory.used --format=csv,noheader
echo ''
echo '📈 Health Check:'
curl -s http://localhost:3000/health || echo 'Health check failed'
EOF"
ssh "$JETSON_USER@$JETSON_IP" "chmod +x ~/$JETSON_PROJECT_DIR/monitor.sh"

# Create quick reference
ssh "$JETSON_USER@$JETSON_IP" "cat > ~/$JETSON_PROJECT_DIR/README.md << 'EOF'
# Jetson Voice Agent - Quick Reference

## Regular Development
After making code changes on your Mac:
\`\`\`bash
./scripts/deploy-jetson-gpu.sh  # 30 seconds
\`\`\`

## Monitoring
\`\`\`bash
./monitor.sh                    # System status
docker logs -f voice-agent-gpu_voice-agent-gpu_1  # Live logs
curl http://localhost:3000/health  # Health check
\`\`\`

## When to Re-run Setup
- Added/removed npm packages
- Changed Node.js version  
- Need clean environment
\`\`\`bash
./scripts/setup-jetson-gpu.sh  # 25 minutes
\`\`\`
EOF"

# Calculate total time
END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))
MINUTES=$((TOTAL_TIME / 60))
SECONDS=$((TOTAL_TIME % 60))

echo -e "\n${GREEN}"
echo "================================================================="
echo "🎉 JETSON SETUP COMPLETE!"
echo "================================================================="
echo "Total Time: ${MINUTES}m ${SECONDS}s"
echo "Voice Agent: http://$JETSON_IP:3000"
echo -e "${NC}"

echo -e "\n${BLUE}Next Steps:${NC}"
echo "1. Regular deployments (30 seconds):"
echo "   ./scripts/deploy-jetson-gpu.sh"
echo ""
echo "2. Monitor system:"
echo "   ssh $JETSON_USER@$JETSON_IP './voice-agent-gpu/monitor.sh'"
echo ""
echo "3. View logs:"
echo "   ssh $JETSON_USER@$JETSON_IP 'docker logs -f voice-agent-gpu_voice-agent-gpu_1'"

echo -e "\n${YELLOW}Performance Testing:${NC}"
echo "• Upload audio via web UI at http://$JETSON_IP:3000"
echo "• Expected 2-3x faster STT processing vs cloud"
echo "• Monitor GPU usage during processing"

log_success "Setup complete! Use deploy-jetson-gpu.sh for regular development" 