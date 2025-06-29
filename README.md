# MCP Voice Agent Monorepo

A voice-controlled AI agent with MCP (Model Context Protocol) tool integration for financial analysis and project management.

## Architecture

```
mcp-voice-agent/
├── hardware/                       # Hardware components
│   ├── esp-idf/                    # ESP-IDF framework
│   └── esp32-s3/                   # ESP32-S3 audio processing board
│       ├── main/                   # ESP32-S3 firmware source
│       ├── components/             # ESP32-S3 components
│       ├── managed_components/     # Managed components
│       └── README.md               # Hardware documentation
├── voice-agent/                    # Main voice agent application
│   ├── src/
│   │   ├── services/
│   │   │   ├── ClaudeService.ts    # Claude LLM provider
│   │   │   ├── OpenAIService.ts    # OpenAI LLM provider
│   │   │   ├── MCPClient.ts        # MCP client for tool integration
│   │   │   ├── LLMFactory.ts       # LLM provider factory
│   │   │   ├── AdaptiveSTTService.ts # GPU-aware speech recognition
│   │   │   ├── HardwareDetectionService.ts # Hardware capability detection
│   │   │   ├── MCPRealtimeBridge.ts # MCP-Realtime API bridge
│   │   │   └── FileCleanupService.ts
│   │   ├── routes/
│   │   │   ├── audio.ts            # Unified audio processing endpoint
│   │   │   ├── realtime-audio.ts   # WebSocket realtime audio
│   │   │   └── text.ts             # Text processing endpoint
│   │   ├── utils/
│   │   │   ├── errorUtils.ts       # Standardized error handling
│   │   │   └── logger.ts           # Structured logging with context
│   │   └── index.ts                # Main application entry point
│   ├── tests/                      # Test files and audio samples
│   └── package.json
├── mcp-servers/                    # MCP tool servers
│   ├── finance-mcp/                # Financial data and analysis tools
│   │   ├── src/
│   │   │   ├── index.ts            # MCP server implementation
│   │   │   ├── MonarchSync.ts      # Monarch Money data import
│   │   │   ├── analysis/           # Financial analysis modules
│   │   │   └── importers/          # Data import utilities (CSV, Amazon, etc.)
│   │   └── package.json
│   └── dev-tools-mcp/              # Development and project management tools
│       ├── src/
│       │   ├── index.ts            # MCP server implementation
│       │   └── utils/              # Database utilities
│       └── package.json
├── data/
│   ├── finance.db                  # SQLite database with financial data  
│   └── projects.db                 # SQLite database with project data
├── docs/                           # Documentation
│   └── OPENAI_REALTIME_API_REFERENCE.md
├── scripts/                        # Deployment and utility scripts
├── docker-compose.dev.yml          # Development Docker configuration
├── docker-compose.jetson.yml       # Jetson GPU Docker configuration
├── Dockerfile                      # Docker container definition
├── mcp-config.json                 # MCP server registry
└── package.json                    # Root monorepo configuration
```

## Container Architecture

The application uses a **single Docker container** with PM2 process management for simplicity and efficiency:

```
┌─────────────────────────────────────────────────────────┐
│                 Voice Agent Container                   │
│                                                         │
│ ┌─────────────────┐    ┌─────────────────────────────┐ │
│ │   PM2 Manager   │    │        Voice Agent          │ │
│ │                 │    │        (Port 3000)          │ │
│ │ - Process Mon.  │──► │                             │ │
│ │ - Auto Restart  │    │ - Text/Audio APIs           │ │
│ │ - Log Mgmt      │    │ - MCP Client (STDIO)        │ │
│ │                 │    │ - GPU-Aware STT             │ │
│ └─────────────────┘    │ - LLM Integration           │ │
│                        │ - Real-time WebSocket       │ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │          MCP Servers (STDIO Communication)          │ │
│ │                                                     │ │
│ │ ┌─────────────────┐  ┌─────────────────────────────┐ │
│ │ │ Finance MCP     │  │ Dev Tools MCP               │ │
│ │ │ - SQL Queries   │  │ - Project Management        │ │
│ │ │ - Analysis      │  │ - SQLite Operations         │ │
│ │ │ - Monarch Sync  │  │ - Project State             │ │
│ │ └─────────────────┘  └─────────────────────────────┘ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────┬───────────────────────────────────────┘
                  │
               External
            localhost:3000
```

**Key Benefits:**
- **Simplicity**: Single container, simpler deployment
- **Efficiency**: Direct STDIO communication, no HTTP overhead
- **Consistency**: Matches Jetson deployment architecture
- **Resource Optimization**: Lower memory footprint, fewer processes

## Features

### Voice Agent ✨ **ENHANCED**
- **OpenAI Realtime API Integration**: True real-time speech-to-speech conversations with streaming audio via WebSocket
- **MCP Realtime Bridge**: Seamless integration of MCP tools with OpenAI Realtime API for voice-driven tool execution
- **Adaptive Speech-to-Text**: GPU-aware audio processing with cloud fallback using AdaptiveSTTService
- **Verbal Response Optimization**: LLM responses optimized for spoken delivery with conversational patterns
- **Text-to-Speech**: AI response generation with OpenAI TTS for hardware consumption
- **Unified Audio Endpoint**: Single `/api/audio` endpoint for complete audio-to-audio pipeline
- **Real-time Audio Streaming**: WebSocket-based streaming audio for instant voice interactions
- **Text Processing**: Direct text input processing with detailed formatting
- **Multi-LLM Support**: Claude 3.5 Sonnet and GPT-4 support with verbal/text context switching
- **MCP Integration**: Tool calling via Model Context Protocol with real-time execution and argument parsing
- **Standardized Error Handling**: Consistent error responses with proper HTTP status codes and structured logging
- **RESTful API**: Express.js server with comprehensive audio and text endpoints

### Finance MCP Server
- **MCP Tools**: SQL queries, schema inspection, financial analysis via MCP protocol
- **Monarch Money Integration**: Live financial data import and sync
- **Amazon Import**: Import Amazon order history, returns, and rentals from CSV exports
- **Database Queries**: Secure SQL query execution with write protection
- **Schema Inspection**: Database table and column information
- **House Affordability Analysis**: Comprehensive affordability calculations
- **Account Management**: Balance and transaction analysis

### Dev Tools MCP Server
- **Project Management**: Create, list, enter, and delete projects via MCP protocol
- **Project State**: Track current active project across sessions
- **SQLite Storage**: Persistent project data with timestamps
- **Tool Integration**: All project operations available through voice agent

### Hardware Components
- **ESP32-S3 Audio Board** (`hardware/esp32-s3/`): Edge audio processing with dual INMP441 microphones and PWM audio output for local wake word detection and audio preprocessing
- **I2S Audio Processing**: 32-bit stereo audio capture and PWM speaker output
- **Wake Word Detection**: Future integration with ESP-Skainet for always-on voice activation
- **Edge Processing**: Local audio preprocessing before sending to main voice agent system
- **WebSocket Integration**: Connects to voice agent via `ws://[IP]:3000/api/audio/realtime`

## Key Features ✨

### OpenAI Realtime API Integration 🎙️ **NEW**
The voice agent now supports **true real-time speech-to-speech conversations** via OpenAI's Realtime API:

**Real-time Streaming Features:**
- **WebSocket Audio Streaming**: Continuous bidirectional audio streaming
- **Live Transcription**: Real-time text transcription as you speak
- **Instant Response**: Sub-second response times for natural conversation
- **Voice Activity Detection**: Automatic speech start/stop detection
- **Interruption Support**: Natural conversation flow with interruptions
- **MCP Tool Integration**: Real-time tool execution during conversation

**Streaming Architecture:**
```
User Voice → [WebSocket Stream] → OpenAI Realtime API → [Live Function Calls] → MCP Tools → [Streaming Response] → Speaker
    ↑                                                                                           ↓
Live interruption support ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←← Live audio playback
```

**Endpoints:**
- **WebSocket**: `ws://localhost:3000/api/audio/realtime` - Real-time streaming audio
- **HTTP**: `POST /api/audio` - Traditional file-based audio processing
- **Test Client**: `test-realtime-client.html` - Browser-based testing interface

### MCP Realtime Bridge 🌉 **NEW**
The voice agent includes a sophisticated **MCP Realtime Bridge** that seamlessly connects MCP tools with the OpenAI Realtime API:

**Bridge Features:**
- **Automatic Tool Discovery**: Dynamically loads all available MCP tools (12 tools from finance + dev servers)
- **Format Conversion**: Converts MCP tool schemas to OpenAI Realtime API format automatically
- **Argument Parsing**: Handles argument conversion between JSON strings and JavaScript objects
- **Real-time Execution**: Executes MCP tools during live voice conversations
- **Error Handling**: Graceful fallback and error reporting for failed tool calls
- **Session Management**: Configures OpenAI sessions with all available MCP tools

**Available Tools via Bridge:**
- **Finance Tools (7)**: Amazon transactions, house affordability, retirement planning, etc.
- **Dev Tools (5)**: Project management, database operations, project state tracking, etc.
- **Real-time Execution**: All tools callable during voice conversations
- **Argument Validation**: Proper JSON parsing and validation for tool parameters

### GPU Acceleration with Adaptive STT

The voice agent features **intelligent speech recognition** that automatically optimizes based on available hardware:

**Adaptive Processing:**
- **Local GPU**: Uses NVIDIA hardware when available for 60-80% faster processing
- **Cloud Fallback**: Gracefully falls back to OpenAI Whisper for compatibility
- **Confidence Scoring**: Switches to cloud for low-confidence local transcriptions
- **Hardware Detection**: Automatically detects and optimizes for Jetson devices

**Performance Improvements:**
| Component | Current (Cloud) | With GPU | Improvement |
|-----------|----------------|----------|-------------|
| Speech-to-Text | 1-3s + network | 200-500ms | **60-80% faster** |
| Total Audio Pipeline | 5-12s | 1-4s | **60-75% faster** |
| Network Dependency | Required | Optional | **Works offline** |

### Standardized Error Handling
All API endpoints now use consistent error handling:

**Error Response Format:**
```json
{
  "error": "Human readable message",
  "message": "Technical details (optional)",
  "code": "ERROR_TYPE",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**Error Types:**
- `VALIDATION_ERROR` (400): Invalid input data
- `EXTERNAL_API_ERROR` (503): External service unavailable (OpenAI, Claude, etc.)
- `SYSTEM_ERROR` (500): Internal system errors

## Quick Start

### Prerequisites
- Docker and Docker Compose (recommended)
- OR Node.js 20+ and npm 9+ (for local development)
- OpenAI API key
- Anthropic API key (optional)
- Monarch Money token (optional, for data sync)

### Docker Setup (Recommended)

Choose the right configuration for your environment:

**🔧 Development**: Lightweight build for fast iteration
**🚀 GPU/Jetson**: Full GPU acceleration for production

#### Development (macOS/Windows/Linux) 🖥️

For development on any platform without GPU support:

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-voice-agent.git
cd mcp-voice-agent

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys (see Environment Variables section below)

# Easy one-command setup
./scripts/docker-dev.sh

# Or manually:
docker compose -f docker-compose.dev.yml up --build -d
```

**Access:**
- 📱 **Voice Agent**: `http://localhost:3000/`
- 📊 **Health Check**: `http://localhost:3000/health`

#### Production (GPU Support) 🚀

For production deployment with GPU support on Jetson or NVIDIA systems:

```bash
# GPU-enabled deployment (Jetson/NVIDIA)
docker compose -f docker-compose.jetson.yml up --build -d

# View logs
docker compose -f docker-compose.jetson.yml logs -f

# Stop services
docker compose -f docker-compose.jetson.yml down
```

**Note**: GPU mode requires NVIDIA Container Toolkit and compatible hardware.

### Environment Variables

Create a `.env` file in the root directory:

```env
# Required for voice processing
OPENAI_API_KEY=your_openai_api_key_here

# LLM Provider (default: openai)
LLM_PROVIDER=openai  # or 'claude'

# Optional - Claude support  
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional - Monarch Money sync
MONARCH_TOKEN=your_monarch_token_here

# Optional - Alpha Vantage for stock analysis
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key_here

# Server configuration
PORT=3000
```

### Docker Commands

```bash
# Development (lightweight, no GPU packages)
docker compose -f docker-compose.dev.yml up --build
docker compose -f docker-compose.dev.yml up -d --build

# GPU deployment (Jetson/NVIDIA systems)
docker compose -f docker-compose.jetson.yml up --build
docker compose -f docker-compose.jetson.yml up -d --build

# View logs from container
docker compose -f docker-compose.dev.yml logs -f
docker compose -f docker-compose.jetson.yml logs -f

# Access container shell
docker compose -f docker-compose.dev.yml exec voice-agent /bin/bash

# Stop services
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.jetson.yml down
```

### Local Development (Without Docker)

```bash
# Clone and install dependencies
git clone https://github.com/yourusername/mcp-voice-agent.git
cd mcp-voice-agent
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Start voice agent in development mode
npm run dev

# Sync financial data from Monarch Money (optional)
cd mcp-servers/finance-mcp && MONARCH_TOKEN=your_token npx tsx src/MonarchSync.ts
```

### ESP32-S3 Hardware Development

For full-stack development with ESP32-S3 hardware:

```bash
# 1. Start voice agent (WebSocket server)
npm run dev  # or docker compose -f docker-compose.dev.yml up -d

# 2. Configure and flash ESP32-S3
cd hardware/esp32-s3/
# See hardware/esp32-s3/README.md for complete setup instructions

# 3. Development cycle
# - Edit ESP32 firmware → rebuild → flash
# - Edit voice agent → auto-reload
# - Test full audio pipeline: ESP32 → Voice Agent → LLM → TTS → ESP32
```

## API Documentation

### Voice Agent Endpoints
- `GET /health` - Health check
- `GET /api/hardware-status` - GPU and hardware information
- `GET /api/stt-status` - Speech-to-text service status
- `POST /api/text` - Text processing with MCP tools
- `POST /api/audio` - Audio file processing
- `WebSocket /api/audio/realtime` - Real-time audio streaming

### Test Clients
- `test-realtime-client.html` - Browser-based WebSocket testing
- `voice-agent/tests/` - Integration test suite

## Database Schema

### Finance Database (finance.db)
- **accounts**: Bank accounts with current balances
- **transactions**: All financial transactions with categories
- **categories**: Transaction categories and subcategories
- **amazon_transactions**: Amazon orders, returns, rentals
- **amazon_import_log**: Import history and statistics

### Projects Database (projects.db)
- **projects**: Project information with timestamps
- **Active project tracking**: In-memory state management

## Development Notes

### Adding New MCP Tools
1. Create tool in appropriate MCP server (`mcp-servers/*/src/index.ts`)
2. Add tool to `ListToolsRequestSchema` handler
3. Implement tool logic in `CallToolRequestSchema` handler
4. Tools automatically available via MCP Realtime Bridge

### Adding New LLM Providers
1. Create service class implementing `LLMProvider` interface
2. Add provider to `LLMFactory.ts`
3. Update environment variable handling

### Container Architecture Benefits
- **Simplicity**: Unified deployment with single container management
- **Efficiency**: Direct STDIO communication eliminates HTTP overhead
- **Resource Optimization**: Lower memory footprint and fewer processes
- **Consistency**: Matches Jetson deployment architecture
- **Security**: Reduced attack surface with secure STDIO channels

## Testing

### Voice Agent Tests
```bash
# Generate test audio files
cd voice-agent && npm run generate:audio

# Run integration tests
npm run test:audio
npm test
```

### Dev Tools Tests
```bash
# Test MCP server functionality
./tests/dev-tools-verification.sh
```

## Hardware Requirements

### ESP32-S3 Development
- **ESP-IDF**: Version 5.1.2 or later
- **Hardware**: XIAO ESP32-S3 with 8MB PSRAM
- **Microphones**: 2x INMP441 I2S microphones
- **Audio Output**: PWM speaker or I2S amplifier
- **Development**: USB-C cable for flashing

### GPU Acceleration
- **NVIDIA GPU**: RTX, GTX, Tesla, A100, or Jetson devices
- **CUDA**: Compatible CUDA version
- **Memory**: 2-4GB GPU memory recommended
- **Docker**: NVIDIA Container Toolkit for GPU access

## Troubleshooting

### Common Issues
- **MCP Connection**: Check `mcp-config.json` configuration
- **GPU Detection**: Verify NVIDIA drivers and Container Toolkit
- **Audio Issues**: Check microphone permissions and audio format support
- **WebSocket**: Ensure port 3000 is accessible and not blocked by firewall

### Debug Commands
```bash
# Check container status
docker compose ps

# View logs
docker compose logs -f

# Test MCP tools
curl -X POST http://localhost:3000/api/text -H "Content-Type: application/json" -d '{"text": "What are my account balances?"}'

# Hardware status
curl http://localhost:3000/api/hardware-status
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Update documentation
5. Submit a pull request

## License

[Your License Here]