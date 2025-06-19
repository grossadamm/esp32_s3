# Docker Setup for MCP Voice Agent

This project uses PM2 in Docker to manage multiple Node.js services concurrently.

## Services

The Docker setup runs 4 services:

1. **Voice Agent** (Port 3000) - Main voice interface **[EXPOSED]**
2. **Finance MCP Server** (Port 3001) - Financial analysis tools **[INTERNAL]**
3. **Voice MCP Server** (Port 3002) - Voice processing tools **[INTERNAL]**
4. **Finance HTTP Server** (Port 3003) - HTTP interface for finance tools **[INTERNAL]**

Only the Voice Agent port (3000) is exposed externally for security. Internal services communicate within the container.

## Quick Start

1. **Set up environment variables:**
   ```bash
   npm run docker:dev
   ```
   This will create a `.env` file if it doesn't exist. Edit it with your API keys:
   ```
   ANTHROPIC_API_KEY=your_actual_key_here
   OPENAI_API_KEY=your_actual_key_here
   ```

2. **Build and start all services:**
   ```bash
   npm run docker:up
   ```

3. **View logs:**
   ```bash
   npm run docker:logs
   ```

4. **Check PM2 process status:**
   ```bash
   npm run docker:status
   ```

5. **Stop services:**
   ```bash
   npm run docker:down
   ```

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
- `voice-mcp.log`
- `finance-http.log`

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