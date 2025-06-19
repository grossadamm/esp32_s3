FROM node:20-alpine AS base

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

# Expose only the main voice agent port
EXPOSE 3000

# Copy PM2 configuration
COPY ecosystem.config.js .

# Start with PM2
CMD ["pm2-runtime", "start", "ecosystem.config.js"] 