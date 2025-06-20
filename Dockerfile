# Lightweight development build
FROM ubuntu:22.04

# Install system dependencies and Node.js
RUN apt-get update && apt-get install -y \
    curl \
    bash \
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
COPY mcp-servers/dev-tools-mcp/package*.json ./mcp-servers/dev-tools-mcp/

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Build all TypeScript projects
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