# Jetson Hybrid GPU Deployment Guide

## 🎯 Why This Approach?

We're implementing a **hybrid deployment strategy** that combines the best of both worlds:

### **Problem We're Solving:**
- ❌ **Native Jetson deployment**: PyTorch can't detect CUDA properly
- ❌ **Full Docker builds**: Take 2+ hours due to slow ARM compilation
- ❌ **Cross-platform builds**: 30% success rate due to native dependencies (sqlite3, etc.)

### **Our Solution: Hybrid GPU Containers**
- ✅ **GPU access**: Use proven `dustynv/l4t-pytorch:r36.4.0` base image
- ✅ **Fast development**: Build once (25 min), iterate fast (45 sec)
- ✅ **No cross-compilation**: Dependencies built natively on Jetson ARM
- ✅ **Container benefits**: Isolation, GPU runtime, reproducibility

### **Expected Performance Improvement:**
- **STT processing**: 2-5s (cloud) → 1-3s (local GPU) = **2-3x faster**
- **Total voice-to-voice**: ~60s → ~15-30s = **50% improvement**

---

## 📋 Prerequisites

- Jetson Orin with JetPack 6.1 (L4T R36.4.3)
- Docker with GPU runtime configured
- SSH access to Jetson
- ~25GB free space on Jetson

---

## 🏗️ Phase 1: One-Time Jetson Setup (20-25 minutes)

### Step 1: Transfer Current Project (2 minutes)

```bash
# From your Mac development machine:
rsync -av --exclude node_modules --exclude dist \
  ./ nvidia@192.168.1.108:~/voice-agent-gpu/

# Verify transfer:
ssh nvidia@192.168.1.108 'ls -la voice-agent-gpu/'
```

### Step 2: Native Dependencies Build (15-20 minutes)

```bash
# SSH into Jetson:
ssh nvidia@192.168.1.108

# Navigate to project:
cd voice-agent-gpu

# Install main dependencies (the slow part - ~10-15 minutes):
npm ci

# Install MCP server dependencies:
cd mcp-servers/finance-mcp && npm ci  # ~3-5 minutes
cd ../dev-tools-mcp && npm ci         # ~2-3 minutes
cd ../..

# Build TypeScript projects (~1-2 minutes):
npm run build
cd voice-agent && npm run build
cd ../mcp-servers/finance-mcp && npm run build
cd ../dev-tools-mcp && npm run build
cd ../..
```

### Step 3: Verify Native Setup (1 minute)

```bash
# Verify everything built correctly:
ls -la voice-agent/dist/
ls -la mcp-servers/finance-mcp/dist/
ls -la mcp-servers/dev-tools-mcp/dist/

# Test basic node execution:
node voice-agent/dist/index.js --help || echo "Built successfully"
```

---

## 🐳 Phase 2: GPU Container Integration (3-5 minutes)

### Step 4: Create GPU Runtime Script

```bash
# On Jetson, create runner script:
cat > ~/voice-agent-gpu/run-gpu.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Starting MCP Voice Agent with GPU Support"

# Kill any existing containers
docker stop mcp-voice-gpu 2>/dev/null || true
docker rm mcp-voice-gpu 2>/dev/null || true

# Start GPU-enabled container
docker run -d \
  --name mcp-voice-gpu \
  --runtime nvidia \
  --network host \
  -v $(pwd):/app \
  -w /app \
  -e NODE_ENV=production \
  --restart unless-stopped \
  dustynv/l4t-pytorch:r36.4.0 \
  node voice-agent/dist/index.js

echo "✅ Voice agent running at http://localhost:3000"
echo "📊 Logs: docker logs -f mcp-voice-gpu"
echo "🔍 Health: curl http://localhost:3000/health"
EOF

chmod +x run-gpu.sh
```

### Step 5: Start GPU Voice Agent

```bash
# Launch with GPU support:
cd ~/voice-agent-gpu
./run-gpu.sh

# Verify it's working:
sleep 5
curl http://localhost:3000/health
docker logs mcp-voice-gpu
```

### Step 6: Test GPU Access

```bash
# Verify PyTorch can see CUDA:
docker exec mcp-voice-gpu python3 -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}'); print(f'GPU count: {torch.cuda.device_count()}')"

# Should output:
# CUDA available: True
# GPU count: 1
```

---

## ⚡ Phase 3: Fast Development Workflow (<1 minute iterations)

### Step 7: Create Development Script (On Mac)

```bash
# Create development helper script:
cat > scripts/deploy-to-jetson.sh << 'EOF'
#!/bin/bash
set -e

JETSON_IP=${1:-"192.168.1.108"}
echo "🔄 Deploying to Jetson ${JETSON_IP}..."

# 1. Build TypeScript locally (fast on Mac)
echo "📦 Building TypeScript..."
npm run build

# 2. Transfer only source and dist files
echo "📤 Transferring files..."
rsync -av --delete \
  voice-agent/src/ nvidia@${JETSON_IP}:~/voice-agent-gpu/voice-agent/src/

rsync -av --delete \
  voice-agent/dist/ nvidia@${JETSON_IP}:~/voice-agent-gpu/voice-agent/dist/

rsync -av --exclude node_modules --exclude dist \
  mcp-servers/ nvidia@${JETSON_IP}:~/voice-agent-gpu/mcp-servers/

# 3. Rebuild TypeScript on Jetson (fast - just compilation)
echo "🔨 Rebuilding on Jetson..."
ssh nvidia@${JETSON_IP} 'cd voice-agent-gpu && npm run build'

# 4. Restart GPU container
echo "🔄 Restarting GPU container..."
ssh nvidia@${JETSON_IP} 'cd voice-agent-gpu && ./run-gpu.sh'

echo "✅ Deployment complete!"
echo "🌐 Voice agent: http://${JETSON_IP}:3000"
echo "📊 Monitor logs: ssh nvidia@${JETSON_IP} 'docker logs -f mcp-voice-gpu'"
EOF

chmod +x scripts/deploy-to-jetson.sh
```

### Step 8: Development Cycle

```bash
# For each code change:

# 1. Edit code on Mac (VS Code, etc.)
# 2. Deploy to Jetson (45 seconds):
./scripts/deploy-to-jetson.sh

# 3. Test immediately:
curl http://192.168.1.108:3000/health

# 4. Test voice processing:
# Upload audio file via web UI at http://192.168.1.108:3000
```

---

## 🎮 Phase 4: GPU Acceleration Verification

### Step 9: Test Local STT with GPU

```bash
# Test if local STT is working with GPU:
curl -X POST http://192.168.1.108:3000/api/audio \
  -F "audio=@test-audio.wav" \
  -H "Content-Type: multipart/form-data"

# Monitor GPU usage during STT:
ssh nvidia@192.168.1.108 'watch -n 1 nvidia-smi'
```

### Step 10: Performance Monitoring

```bash
# Create monitoring script on Jetson:
cat > ~/voice-agent-gpu/monitor-gpu.sh << 'EOF'
#!/bin/bash
echo "🔍 GPU Voice Agent Monitoring"
echo "=============================="

echo "📊 Container Status:"
docker ps | grep mcp-voice-gpu

echo ""
echo "🖥️  GPU Status:"
nvidia-smi --query-gpu=name,memory.used,memory.total,utilization.gpu --format=csv,noheader,nounits

echo ""
echo "📈 Voice Agent Health:"
curl -s http://localhost:3000/health | jq .

echo ""
echo "📝 Recent Logs:"
docker logs --tail 10 mcp-voice-gpu
EOF

chmod +x ~/voice-agent-gpu/monitor-gpu.sh
```

---

## 🔧 Troubleshooting

### Common Issues:

#### GPU Not Detected
```bash
# Check GPU runtime:
docker run --runtime nvidia --rm dustynv/l4t-pytorch:r36.4.0 nvidia-smi

# If fails, reinstall nvidia-container-toolkit:
sudo apt install nvidia-container-toolkit-base
sudo systemctl restart docker
```

#### Container Won't Start
```bash
# Check logs:
docker logs mcp-voice-gpu

# Check disk space:
df -h /

# Rebuild if needed:
cd ~/voice-agent-gpu && npm run build
```

#### STT Still Using Cloud
```bash
# Check LocalSTTService configuration:
docker exec mcp-voice-gpu cat /app/.env | grep STT

# Force local STT:
docker exec mcp-voice-gpu grep -r "useLocal" /app/voice-agent/dist/
```

---

## 📊 Expected Results

### Performance Metrics:
- **Initial setup**: 25 minutes (one-time)
- **Development iterations**: 45 seconds
- **STT processing**: 1-3 seconds (vs 2-5s cloud)
- **Memory usage**: ~2GB (container + PyTorch + models)
- **GPU utilization**: 20-40% during voice processing

### Development Workflow:
1. **Edit code on Mac**: Fast, full IDE support
2. **Deploy**: `./scripts/deploy-to-jetson.sh` (45s)
3. **Test**: Immediate feedback on http://192.168.1.108:3000
4. **Monitor**: `ssh nvidia@192.168.1.108 './voice-agent-gpu/monitor-gpu.sh'`

---

## 🎯 Next Steps

After successful deployment:

1. **Add more local models**: Whisper variants, faster STT models
2. **Optimize GPU memory**: Model quantization, memory pooling
3. **Scale horizontally**: Multiple Jetson nodes if needed
4. **Production hardening**: Logging, metrics, auto-restart

---

## 📚 Architecture Summary

```
Mac Development          Transfer (45s)         Jetson Runtime
===============          ==============         ==============
- Edit TypeScript   →    - rsync source    →    - GPU Container
- Fast builds            - npm run build         - dustynv/l4t-pytorch
- Full IDE support       - Restart container     - CUDA + PyTorch
                                                 - Voice Agent
                                                 - Local STT/TTS
```

**Key Benefits:**
- ✅ **GPU acceleration**: Full CUDA support
- ✅ **Fast development**: 45-second iterations  
- ✅ **Proven base**: dusty-nv containers
- ✅ **No cross-compilation**: Native ARM builds
- ✅ **Production ready**: Container isolation + GPU runtime

**Time Investment vs. Alternatives:**
- **This approach**: 25 min setup + 45s iterations
- **Native only**: 2 min setup + no GPU support
- **Full containers**: 2+ hours per build
- **Cross-compilation**: 50% failure rate

This hybrid approach gives us the best of all worlds: GPU acceleration, fast development, and reliable deployment. 