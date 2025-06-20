# Docker Setup for MCP Voice Agent

This project provides two Docker configurations:
- **Production** (`docker-compose.yml`): Optimized for Jetson devices with GPU support
- **Development** (`docker-compose.dev.yml`): macOS/Windows compatible without GPU requirements

## Services

The Docker setup runs 3 services:

1. **Voice Agent** (Port 3000) - Main voice interface with WebSocket support **[EXPOSED]**
2. **Finance MCP Server** (Port 3001) - Financial analysis tools **[INTERNAL]**
3. **Finance HTTP Server** (Port 3003) - HTTP interface for finance tools **[INTERNAL]**

Only the Voice Agent port (3000) is exposed externally for security. Internal services communicate within the container.

**Voice Agent Features:**
- HTTP endpoints: `/api/text`, `/api/audio` 
- WebSocket endpoint: `/api/audio/realtime` for real-time audio streaming
- Health checks and status endpoints

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
- 📱 **Mobile UI**: `http://localhost:3000/`
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

Inside the container, PM2 manages all processes:

- View status: `docker compose exec mcp-voice-agent pm2 status`
- View logs: `docker compose exec mcp-voice-agent pm2 logs`
- Restart service: `docker compose exec mcp-voice-agent pm2 restart <service-name>`
- Monitor: `docker compose exec mcp-voice-agent pm2 monit`

## Logs

All service logs are stored in the `./logs` directory and mounted as volumes:
- `voice-agent.log`
- `finance-mcp.log`
- `finance-http.log`

## Testing

### Real-time Audio Testing 🎙️
After starting the services, test the real-time audio functionality:

```bash
# Start services
npm run docker:up

# Open the interactive test client in browser
open voice-agent/test-realtime-client.html
# Or navigate to: http://localhost:3000/static/test-realtime-client.html (if served)

# Test WebSocket connection
# 1. Click "Connect" in the browser interface
# 2. Click "Start Recording" and speak
# 3. See live transcription and audio responses
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
```

## Health Checks

The main service includes health checks on port 3000. Make sure your voice agent implements a `/health` endpoint.

## Volumes

- `./data` - SQLite database file storage (file-based, no server needed)
- `./logs` - Service logs
- `./uploads` - File uploads for voice agent

## Troubleshooting

1. **Port conflicts:** Only port 3000 is exposed - change in `docker-compose.yml` if needed
2. **Build issues:** Run `npm run docker:build` to rebuild
3. **Process issues:** Use `npm run docker:status` to check PM2 processes
4. **Clean restart:** `npm run docker:down && npm run docker:up`
5. **Internal service access:** MCP servers (3001-3003) are only accessible within the container

## Internal Service Access

To access internal services for debugging:
```bash
# Execute commands inside the container
docker compose exec mcp-voice-agent curl http://localhost:3003/api/schema
docker compose exec mcp-voice-agent curl http://localhost:3001/health
``` 