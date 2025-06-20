#!/bin/bash
set -e

# =============================================================================
# Jetson GPU Deploy Script (Regular use, ~30 seconds)
# 
# Purpose: Fast deployment for code changes during development
# Run when: Making code changes, configuration updates, debugging
# 
# Prerequisites: Must run setup-jetson-gpu.sh first for initial setup
# 
# This script leverages pre-built ARM dependencies for fast iterations
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
echo "🚀 Fast Jetson deployment (~30 seconds)"
echo "Target: $JETSON_USER@$JETSON_IP"
echo -e "${NC}"

START_TIME=$(date +%s)

# Check if setup was completed
log_info "Checking setup status..."
if ! ssh "$JETSON_USER@$JETSON_IP" "test -f $JETSON_PROJECT_DIR/.setup-complete"; then
    log_error "Initial setup required!"
    echo ""
    echo "Run the setup script first:"
    echo "  ./scripts/setup-jetson-gpu.sh"
    echo ""
    echo "This will:"
    echo "• Build ARM dependencies (25 minutes, one-time)"  
    echo "• Setup GPU container environment"
    echo "• Configure fast deployment workflow"
    exit 1
fi

# Fast project sync (excludes pre-built node_modules)
log_info "Syncing code changes..."
rsync -av --delete \
    --exclude node_modules \
    --exclude .setup-complete \
    --exclude .git \
    --exclude logs \
    --exclude uploads \
    --exclude ssl \
    ./ "$JETSON_USER@$JETSON_IP:~/$JETSON_PROJECT_DIR/"

# Quick build using pre-built dependencies
log_info "Building TypeScript..."
ssh "$JETSON_USER@$JETSON_IP" "cd $JETSON_PROJECT_DIR && npm run build"

# Restart GPU container to apply changes
log_info "Restarting voice agent..."
ssh "$JETSON_USER@$JETSON_IP" "cd $JETSON_PROJECT_DIR && docker compose -f docker-compose.jetson.yml restart voice-agent"

# Quick health check
log_info "Verifying deployment..."
sleep 3
HEALTH_CHECK=$(ssh "$JETSON_USER@$JETSON_IP" "curl -s http://localhost:3000/health" || echo "failed")

if [[ $HEALTH_CHECK == *"ok"* ]] || [[ $HEALTH_CHECK == *"healthy"* ]]; then
    log_success "Voice agent restarted successfully" 
else
    log_warning "Health check unclear, but deployment completed"
    log_info "Check logs: ssh $JETSON_USER@$JETSON_IP 'cd voice-agent-gpu && docker compose -f docker-compose.jetson.yml logs voice-agent'"
fi

# Calculate timing
END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))

echo -e "\n${GREEN}✅ Deployment complete in ${TOTAL_TIME} seconds!${NC}"
echo -e "🌐 Voice agent: http://$JETSON_IP:3000"

echo -e "\n${BLUE}Quick Commands:${NC}"
echo "• Monitor: ssh $JETSON_USER@$JETSON_IP './voice-agent-gpu/monitor.sh'"
echo "• Logs: ssh $JETSON_USER@$JETSON_IP 'cd voice-agent-gpu && docker compose -f docker-compose.jetson.yml logs -f voice-agent'"
echo "• Test: curl http://$JETSON_IP:3000/health" 