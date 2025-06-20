#!/bin/bash

# Voice Agent GPU-Aware Deployment Script
# Automatically detects NVIDIA GPU and deploys with appropriate configuration

set -e

echo "🚀 Voice Agent GPU-Aware Deployment"
echo "=================================="

# Check if running on NVIDIA hardware
check_nvidia_gpu() {
    echo "🔍 Checking for NVIDIA GPU..."
    
    if command -v nvidia-smi >/dev/null 2>&1; then
        echo "✅ NVIDIA GPU detected:"
        nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader
        
        # Check if it's a Jetson device
        if [ -f /proc/device-tree/model ]; then
            MODEL=$(cat /proc/device-tree/model 2>/dev/null || echo "unknown")
            if echo "$MODEL" | grep -i "jetson" >/dev/null; then
                echo "🚀 Jetson device detected: $MODEL"
                echo "JETSON_DEVICE=true"
                return 0
            fi
        fi
        
        echo "🖥️  Desktop/Server GPU detected"
        echo "DESKTOP_GPU=true"
        return 0
    else
        echo "ℹ️  No NVIDIA GPU detected - deploying with CPU-only configuration"
        echo "CPU_ONLY=true"
        return 1
    fi
}

# Check Docker and NVIDIA Container Toolkit
check_docker_nvidia() {
    echo ""
    echo "🐳 Checking Docker and NVIDIA Container Toolkit..."
    
    if ! command -v docker >/dev/null 2>&1; then
        echo "❌ Docker not found. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
        echo "❌ Docker Compose not found. Please install Docker Compose."
        exit 1
    fi
    
    # Check for NVIDIA Container Toolkit
    if check_nvidia_gpu; then
        if docker run --rm --runtime=nvidia nvidia/cuda:11.0-base nvidia-smi >/dev/null 2>&1; then
            echo "✅ NVIDIA Container Toolkit is working"
            GPU_SUPPORT=true
        else
            echo "⚠️  NVIDIA GPU detected but Container Toolkit not working"
            echo "   Please install NVIDIA Container Toolkit:"
            echo "   https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html"
            echo ""
            echo "   Continuing with CPU-only deployment..."
            GPU_SUPPORT=false
        fi
    else
        GPU_SUPPORT=false
    fi
}

# Deploy with appropriate configuration
deploy_application() {
    echo ""
    echo "🏗️  Building Voice Agent..."
    
    if [ "$GPU_SUPPORT" = true ]; then
        echo "🎯 Building with GPU acceleration..."
        
        # Verify GPU access in docker-compose.yml
        if ! grep -q "nvidia" docker-compose.yml; then
            echo "⚠️  docker-compose.yml may not have GPU configuration"
            echo "   Make sure it includes GPU support settings"
        fi
        
        # Build first (don't stop existing containers yet)
        if ! docker compose build; then
            echo "❌ Build failed! Keeping existing deployment running."
            return 1
        fi
        
        echo "✅ Build successful! Stopping existing containers..."
        docker compose down || true
        docker compose up -d
        
    else
        echo "💻 Building with CPU-only configuration..."
        
        # Create a temporary docker-compose.override.yml to disable GPU settings
        cat > docker-compose.override.yml << EOF
services:
  mcp-voice-agent:
    deploy:
      resources:
        reservations: {}
    environment:
      - NODE_ENV=production
      - LLM_PROVIDER=openai
      - ANTHROPIC_API_KEY=\${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=\${OPENAI_API_KEY}
      # GPU environment variables removed for CPU-only
EOF
        
        # Build first (don't stop existing containers yet)
        if ! docker compose build; then
            echo "❌ Build failed! Keeping existing deployment running."
            rm -f docker-compose.override.yml
            return 1
        fi
        
        echo "✅ Build successful! Stopping existing containers..."
        docker compose down || true
        docker compose up -d
        
        # Clean up override file
        rm -f docker-compose.override.yml
    fi
}

# Health check and status
check_deployment() {
    echo ""
    echo "🔍 Checking deployment status..."
    
    # Wait for service to start
    echo "Waiting for services to start..."
    sleep 10
    
    # Check if containers are running
    if docker compose ps | grep -q "Up"; then
        echo "✅ Containers are running"
        
        # Check application health
        echo "Checking application health..."
        if curl -f http://localhost:3000/health >/dev/null 2>&1; then
            echo "✅ Application is healthy"
            
            # Show hardware status
            echo ""
            echo "📊 Hardware Status:"
            curl -s http://localhost:3000/api/hardware-status | python3 -m json.tool 2>/dev/null || echo "Could not fetch hardware status"
            
            echo ""
            echo "🎙️  STT Service Status:"
            curl -s http://localhost:3000/api/stt-status | python3 -m json.tool 2>/dev/null || echo "Could not fetch STT status"
            
        else
            echo "❌ Application health check failed"
            echo "Check logs with: docker compose logs"
        fi
    else
        echo "❌ Containers failed to start"
        echo "Check logs with: docker compose logs"
        exit 1
    fi
}

# Show deployment summary
show_summary() {
    echo ""
    echo "🎉 Deployment Summary"
    echo "===================="
    echo "Voice Agent is running at: http://localhost:3000"
    echo ""
    echo "Available endpoints:"
    echo "• Health check: GET http://localhost:3000/health"
    echo "• Hardware status: GET http://localhost:3000/api/hardware-status"
    echo "• STT status: GET http://localhost:3000/api/stt-status"
    echo "• ESP32 Audio: POST http://localhost:3000/api/audio"
    echo "• Debug Audio: POST http://localhost:3000/api/audioDebug"
    echo "• Text: POST http://localhost:3000/api/text"
    echo ""
    echo "Logs: docker compose logs -f"
    echo "Stop: docker compose down"
    
    if [ "$GPU_SUPPORT" = true ]; then
        echo ""
        echo "🚀 GPU acceleration is ENABLED"
        echo "   Local STT should provide faster response times"
    else
        echo ""
        echo "☁️  Using cloud-only configuration"
        echo "   All STT requests will use OpenAI Whisper API"
    fi
}

# Main execution
main() {
    check_docker_nvidia
    deploy_application
    check_deployment
    show_summary
}

# Handle command line arguments
case "${1:-}" in
    "--help"|"-h")
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h    Show this help message"
        echo "  --gpu-only    Force GPU-only deployment (fail if no GPU)"
        echo "  --cpu-only    Force CPU-only deployment"
        echo ""
        echo "This script automatically detects NVIDIA GPU hardware and deploys"
        echo "the Voice Agent with appropriate configuration."
        exit 0
        ;;
    "--gpu-only")
        if ! check_nvidia_gpu; then
            echo "❌ No NVIDIA GPU detected but --gpu-only specified"
            exit 1
        fi
        GPU_SUPPORT=true
        ;;
    "--cpu-only")
        echo "🔒 Forcing CPU-only deployment"
        GPU_SUPPORT=false
        ;;
    "")
        # Default behavior - auto-detect
        main
        ;;
    *)
        echo "❌ Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac

if [ "${1:-}" != "" ]; then
    # Run main for non-default cases
    main
fi 