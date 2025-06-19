#!/bin/bash

# Create logs directory if it doesn't exist
mkdir -p logs

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cat > .env << EOL
# Copy this to .env and fill in your values
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Override default ports
VOICE_AGENT_PORT=3000
FINANCE_MCP_PORT=3001
VOICE_MCP_PORT=3002
FINANCE_HTTP_PORT=3003
EOL
    echo "Please edit .env with your API keys before running docker compose up"
fi

# Build and start services
echo "Building and starting MCP Voice Agent..."
docker compose up --build 