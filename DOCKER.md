# Docker Setup for MCP Voice Agent

This project provides two Docker configurations:
- **Production** (`docker-compose.yml`): Optimized for Jetson devices with GPU support
- **Development** (`docker-compose.dev.yml`): macOS/Windows compatible without GPU requirements

## Architecture

The Docker setup runs a **single container** with PM2 managing the voice agent process:

1. **Voice Agent** (Port 3000) - Main voice interface with WebSocket support **[EXPOSED]**
   - HTTP endpoints: `/api/text`, `/api/audio` 
   - WebSocket endpoint: `/api/audio/realtime` for real-time audio streaming
   - MCP client integration via STDIO communication
   - Health checks and status endpoints

2. **MCP Servers** - On-demand processes spawned via STDIO
   - **Finance MCP**: Financial analysis tools (spawned by voice agent)
   - **Dev Tools MCP**: Project management tools (spawned by voice agent)
   - **No HTTP servers**: Direct STDIO communication for security and efficiency

**Benefits:**
- **Simplified Deployment**: Single container to manage
- **Reduced Attack Surface**: No internal HTTP servers
- **Lower Resource Usage**: Fewer persistent processes
- **STDIO Security**: MCP communication via secure channels

## Quick Start

### Development (macOS/Windows) 🖥️

For development on macOS or Windows without GPU support:

```bash
# Easy one-command setup
./scripts/docker-dev.sh

# Or manually:
docker compose -f docker-compose.dev.yml up --build -d
```

**Access:**
- 📱 **Voice Agent**: `http://localhost:3000/`
- 📊 **Health Check**: `http://localhost:3000/health`

### Production (Jetson/GPU) 🚀

For production deployment on Jetson devices with GPU support:

```bash
# Standard production deployment
docker compose up --build -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

**Note**: Production mode requires NVIDIA Container Toolkit for GPU support.

## Development

For development with hot reload:
```bash
npm run docker:dev
```

## PM2 Management

Inside the container, PM2 manages the voice agent process:

- View status: `docker compose exec voice-agent pm2 status`
- View logs: `docker compose exec voice-agent pm2 logs`
- Restart voice agent: `docker compose exec voice-agent pm2 restart voice-agent`
- Monitor processes: `docker compose exec voice-agent pm2 monit`

**MCP Server Management:**
- MCP servers are spawned automatically by the voice agent as needed
- No manual process management required for MCP servers
- Communication happens via secure STDIO channels

## Logs

Service logs are stored in the `./logs` directory and mounted as volumes:
- `voice-agent.log` - Main voice agent logs
- `voice-agent-error.log` - Voice agent error logs
- `voice-agent-out.log` - Voice agent output logs

## Testing

### Real-time Audio Testing 🎙️
After starting the services, test the real-time audio functionality:

```bash
# Start services
npm run docker:up

# Open the interactive test client in browser
open voice-agent/test-realtime-client.html

# Test WebSocket connection
# 1. Click "Connect" in the browser interface
# 2. Click "Start Recording" and speak
# 3. See live transcription and audio responses
# 4. Test MCP integration: "What's my project status?" or "Show my expenses"
```

### Traditional API Testing
```bash
# Test text endpoint
curl -X POST http://localhost:3000/api/text \
  -H "Content-Type: application/json" \
  -d '{"text": "What are my expenses?"}'

# Test audio endpoint  
curl -X POST http://localhost:3000/api/audio \
  -F "audio=@sample.wav" \
  --output response.mp3

# Health check
curl http://localhost:3000/health

# Hardware status
curl http://localhost:3000/api/hardware-status

# STT service status
curl http://localhost:3000/api/stt-status
```

## Health Checks

The main service includes health checks on port 3000. The voice agent implements comprehensive health monitoring:
- `/health` - Overall service health
- `/api/hardware-status` - GPU and hardware capabilities  
- `/api/stt-status` - Speech-to-text service status

## Volumes

- `./data` - SQLite database file storage (file-based, no server needed)
- `./logs` - Service logs
- `./uploads` - File uploads for voice agent

## Troubleshooting

1. **Port conflicts:** Only port 3000 is exposed - change in `docker-compose.yml` if needed
2. **Build issues:** Run `npm run docker:build` to rebuild
3. **Process issues:** Use `npm run docker:status` to check PM2 processes
4. **Clean restart:** `npm run docker:down && npm run docker:up`
5. **MCP communication issues:** Check voice agent logs for STDIO connection errors

## Container Access

To access the container for debugging:
```bash
# Execute commands inside the container
docker compose exec voice-agent /bin/bash

# Check PM2 status
docker compose exec voice-agent pm2 status

# View application structure
docker compose exec voice-agent ls -la /app

# Run MCP tools directly for testing
docker compose exec voice-agent node mcp-servers/finance-mcp/dist/index.js
```

## Development vs Production Differences

### Development (`docker-compose.dev.yml`)
- No GPU support
- Volume mounts for hot reload
- Debug logging enabled
- Optimized for macOS/Windows

### Production (`docker-compose.yml`)
- Full GPU support with NVIDIA runtime
- Optimized for Jetson devices
- Production logging
- Security hardened 