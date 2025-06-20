# Multi-stage build with GPU support detection
FROM ubuntu:22.04 AS base

# Install system dependencies and Node.js
RUN apt-get update && apt-get install -y \
    curl \
    bash \
    python3 \
    python3-pip \
    build-essential \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

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

# Install GPU-capable packages (detection happens at runtime)
RUN echo "Installing GPU-capable ML packages for Jetson deployment..." && \
    pip3 install --no-cache-dir torch torchvision torchaudio && \
    pip3 install --no-cache-dir openai-whisper transformers && \
    pip3 install --no-cache-dir onnxruntime || echo "onnxruntime-gpu not available, continuing with CPU version"

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