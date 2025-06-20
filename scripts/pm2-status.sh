#!/bin/bash

# Check PM2 status inside the container
echo "Checking PM2 processes..."
docker compose exec voice-agent pm2 status

echo ""
echo "Recent logs:"
docker compose exec voice-agent pm2 logs --lines 20 