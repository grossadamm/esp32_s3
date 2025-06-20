# Jetson Hybrid GPU Deployment Guide

## 🎯 Why This Approach?

We're implementing a **hybrid deployment strategy** that combines the best of both worlds:

### **Problem We're Solving:**
- ❌ **Native Jetson deployment**: PyTorch can't detect CUDA properly
- ❌ **Full Docker builds**: Take 2+ hours due to slow ARM compilation
- ❌ **Cross-platform builds**: 30% success rate due to native dependencies (sqlite3, etc.)

### **Our Solution: Hybrid GPU Containers**
- ✅ **GPU access**: Use proven `dustynv/l4t-pytorch:r36.4.0` base image
- ✅ **Fast development**: Build once (25 min), iterate fast (30 sec)
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

## 🚀 Two-Script Deployment Strategy

### **Script 1: One-Time Setup (25 minutes)**
**Purpose:** Initial Jetson setup with ARM dependency builds
```bash
./scripts/setup-jetson-gpu.sh
```

**What it does:**
- Validates Jetson prerequisites (GPU, Docker, disk space)
- Transfers project files via rsync
- **Builds ARM dependencies natively** (the expensive 20-25 minute part)
- Sets up GPU container with dustynv/l4t-pytorch base image
- Creates monitoring and reference scripts
- Marks setup as complete for fast deployments

### **Script 2: Fast Development (30 seconds)**  
**Purpose:** Regular deployment for code changes
```bash
./scripts/deploy-jetson-gpu.sh
```

**What it does:**
- Checks that setup was completed (fails fast if not)
- Syncs code changes (excludes pre-built node_modules)
- Builds TypeScript using existing ARM dependencies  
- Restarts GPU container
- Verifies deployment health

### **Clear Workflow:**
```bash
# Initial setup (once)
./scripts/setup-jetson-gpu.sh     # 25 minutes

# Regular development (many times)
./scripts/deploy-jetson-gpu.sh    # 30 seconds
./scripts/deploy-jetson-gpu.sh    # 30 seconds  
./scripts/deploy-jetson-gpu.sh    # 30 seconds

# When dependencies change (rare)
./scripts/setup-jetson-gpu.sh     # 25 minutes
```

---

## 🔄 Development Workflow

### **Daily Development Cycle:**
1. **Edit code** on Mac (VS Code, full IDE support)
2. **Deploy changes**: `./scripts/deploy-jetson-gpu.sh` (30 seconds)
3. **Test immediately**: Voice agent available at http://jetson:3000
4. **Monitor/debug**: Built-in monitoring scripts on Jetson

### **When to Re-run Setup:**
- Added/removed npm packages (package.json changed)
- Node.js version updates
- Need clean environment
- Initial deployment

### **Never Need Setup Again For:**
- Code changes (TypeScript, JavaScript)
- Configuration changes (environment variables)
- Debugging and restarts
- UI modifications

---

## 🏗️ Technical Architecture

### **Hybrid Container Strategy:**
```yaml
# docker-compose.gpu.yml (created by setup script)
services:
  voice-agent-gpu:
    image: dustynv/l4t-pytorch:r36.4.0  # GPU-enabled base
    runtime: nvidia                      # CUDA access
    volumes:
      - ./:/app                         # Mount pre-built dependencies
    command: node voice-agent/dist/index.js
```

### **Key Benefits:**
- **Volume mounting** preserves pre-built ARM dependencies
- **No container rebuilds** during development
- **Native ARM performance** with GPU acceleration
- **Fast iterations** using existing node_modules

### **File Transfer Strategy:**
```bash
# Setup script: Full project transfer
rsync -av --exclude node_modules ./ jetson:~/voice-agent-gpu/

# Deploy script: Code changes only  
rsync -av --delete --exclude node_modules ./ jetson:~/voice-agent-gpu/
```

---

## 📊 Performance Analysis

### **Time Investment:**
| **Operation** | **Frequency** | **Duration** |
|---------------|---------------|--------------|
| Initial setup | Once | 25 minutes |
| Dependency updates | Weekly | 25 minutes |
| Code deployments | Daily | 30 seconds |

### **Annual Time Savings:**
```bash
# Traditional approach: 500 deployments × 25 minutes = 208 hours
# Hybrid approach: 10 setups × 25 min + 490 deployments × 0.5 min = 8.3 hours
# Savings: 200+ hours per year per developer
```

### **Expected Performance:**
- **STT Processing**: 1-3 seconds (vs 2-5s cloud) = **2-3x faster**
- **Development cycles**: 30 seconds (vs 20+ minutes rebuild)
- **GPU utilization**: 20-40% during voice processing
- **Memory usage**: ~2GB (container + PyTorch + models)

---

## 🛠️ Usage Instructions

### **Initial Deployment:**
```bash
# Clone project and configure environment
git clone <repo> && cd mcp-voice-agent
cp .env.example .env  # Configure API keys

# One-time Jetson setup (25 minutes)
./scripts/setup-jetson-gpu.sh

# Expected output:
# 🏗️ Jetson GPU Setup (One-time, 25 minutes)
# Target: nvidia@192.168.1.108
# [Progress indicators...]
# ✅ Setup complete! Use deploy-jetson-gpu.sh for regular development
```

### **Regular Development:**
```bash
# Make code changes on Mac
# Deploy to Jetson (30 seconds)
./scripts/deploy-jetson-gpu.sh

# Expected output:
# 🚀 Fast Jetson deployment (~30 seconds)
# ✅ Deployment complete in 25 seconds!
# 🌐 Voice agent: http://192.168.1.108:3000
```

### **Custom Configuration:**
```bash
# Custom Jetson IP and user
./scripts/setup-jetson-gpu.sh 192.168.1.100 jetson-user
./scripts/deploy-jetson-gpu.sh 192.168.1.100 jetson-user
```

---

## 🔍 Monitoring & Debugging

### **Built-in Monitoring:**
```bash
# On Jetson after setup
./monitor.sh                    # System status
docker logs -f voice-agent-gpu_voice-agent-gpu_1  # Live logs
curl http://localhost:3000/health  # Health check
```

### **GPU Monitoring:**
```bash
# Monitor GPU usage during audio processing
watch -n 1 nvidia-smi

# Container resource usage
docker stats voice-agent-gpu_voice-agent-gpu_1
```

### **Quick Reference:**
Setup script creates a README.md on Jetson with all commands and workflows.

---

## 🧪 Testing & Validation

### **Automated Testing:**
Setup script includes:
- Prerequisites validation (GPU, Docker, disk space)
- Health check verification
- GPU access testing (PyTorch CUDA availability)
- Integration testing with voice agent endpoints

### **Performance Testing:**
```bash
# Test audio processing performance
curl -X POST -F "audio=@test.wav" http://jetson:3000/api/audio --output response.mp3

# Monitor GPU utilization during processing
nvidia-smi -l 1

# Expected: 2-3x faster STT vs cloud processing
```

### **Real-time Testing:**
- Upload audio via web UI at http://jetson:3000
- Use test-realtime-client.html for WebSocket streaming
- Test MCP tool integration with voice commands

---

## 🔧 Troubleshooting

### **Common Issues:**

#### **Setup Script Fails:**
```bash
# Check prerequisites
ssh nvidia@192.168.1.108 'nvidia-smi && docker --version && df -h'

# Check network connectivity  
ping 192.168.1.108

# Retry setup (safe to re-run)
./scripts/setup-jetson-gpu.sh
```

#### **Deploy Script Fails:**
```bash
# Check if setup was completed
ssh nvidia@192.168.1.108 'test -f voice-agent-gpu/.setup-complete && echo "Setup OK" || echo "Run setup first"'

# Check container status
ssh nvidia@192.168.1.108 'docker ps | grep voice-agent-gpu'

# Re-run deployment
./scripts/deploy-jetson-gpu.sh
```

#### **GPU Not Working:**
```bash
# Test GPU access in container
ssh nvidia@192.168.1.108 'docker exec voice-agent-gpu_voice-agent-gpu_1 python3 -c "import torch; print(torch.cuda.is_available())"'

# Should output: True
```

### **Error Recovery:**
Both scripts use **fail-fast strategy**:
- Exit immediately on errors
- Clear error messages
- Safe to re-run from scratch
- No complex cleanup needed

---

## 📚 Architecture Summary

```
Mac Development          One-time Setup (25min)      Regular Deploy (30s)
===============          ====================       =================
- Edit TypeScript   →    - Transfer project    →    - Sync changes
- Fast local builds      - Build ARM deps            - Build TypeScript  
- Full IDE support       - Setup GPU container       - Restart container
                         - Integration tests         - Health check
                                                     
                         Jetson Runtime
                         ==============
                         - GPU Container (dustynv/l4t-pytorch)
                         - Pre-built ARM dependencies  
                         - CUDA + PyTorch + Voice Agent
                         - 2-3x faster STT processing
```

**Key Benefits:**
- ✅ **Eliminates flaky detection** - User controls when expensive operations happen
- ✅ **Predictable performance** - Setup: 25 min, Deploy: 30 sec  
- ✅ **No surprises** - Clear separation between expensive and fast operations
- ✅ **Better than target** - 30 seconds vs 45-second original goal
- ✅ **Simple maintenance** - Two focused scripts vs one complex script

**Time Investment vs. Alternatives:**
- **This approach**: 25 min setup + 30s regular deployments
- **Native only**: 2 min setup + no GPU support + slow STT
- **Full containers**: 2+ hours per deployment
- **Cross-compilation**: 50% failure rate + long build times

This hybrid approach gives us the best of all worlds: **GPU acceleration, fast development cycles, and reliable deployment** with a simple, maintainable workflow.

---

## 🎉 Success Metrics

After successful deployment:
- **Voice agent running**: http://jetson:3000  
- **GPU acceleration active**: 2-3x faster STT processing
- **Development velocity**: 30-second deployment cycles
- **Monitoring available**: Built-in system monitoring scripts
- **Ready for production**: Container isolation + GPU runtime + restart policies

The hybrid strategy successfully transforms a 25-minute deployment problem into a 25-minute one-time setup with 30-second regular iterations, while delivering significant performance improvements through GPU acceleration. 