# Multi-stage build with GPU support detection
FROM node:20-alpine AS base

# Install system dependencies for GPU detection
RUN apk add --no-cache \
    curl \
    bash \
    python3 \
    py3-pip \
    build-base

# Install PM2 and tsx globally
RUN npm install -g pm2 tsx

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY voice-agent/package*.json ./voice-agent/
COPY mcp-servers/finance-mcp/package*.json ./mcp-servers/finance-mcp/

# Install all dependencies (keep devDependencies for tsx)
RUN npm ci

# Copy source code
COPY . .

# Hardware detection and conditional GPU setup
RUN echo "Detecting hardware capabilities..." && \
    if command -v nvidia-smi >/dev/null 2>&1; then \
        echo "✅ NVIDIA GPU detected - installing GPU-optimized packages"; \
        # Install GPU-optimized packages
        pip3 install --break-system-packages --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118 || \
        pip3 install --break-system-packages --no-cache-dir torch torchvision torchaudio; \
        pip3 install --break-system-packages --no-cache-dir openai-whisper transformers; \
        pip3 install --break-system-packages --no-cache-dir onnxruntime-gpu || pip3 install --break-system-packages --no-cache-dir onnxruntime; \
    else \
        echo "ℹ️  No NVIDIA GPU detected - using CPU-only packages"; \
        pip3 install --break-system-packages --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu; \
        pip3 install --break-system-packages --no-cache-dir openai-whisper transformers; \
        pip3 install --break-system-packages --no-cache-dir onnxruntime; \
    fi

# Build all TypeScript projects to ensure fresh compilation
RUN echo "Building TypeScript projects..." && \
    cd voice-agent && npm run build && \
    cd ../mcp-servers/finance-mcp && npm run build && \
    cd ../dev-tools-mcp && npm run build && \
    cd ../..

# Verify builds completed successfully
RUN echo "Verifying builds..." && \
    ls -la voice-agent/dist/ && \
    ls -la mcp-servers/finance-mcp/dist/ && \
    ls -la mcp-servers/dev-tools-mcp/dist/

# Expose only the main voice agent port
EXPOSE 3000

# Copy PM2 configuration
COPY ecosystem.config.js .

# Start with PM2
CMD ["pm2-runtime", "start", "ecosystem.config.js"] 