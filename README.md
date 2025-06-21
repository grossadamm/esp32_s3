# MCP Voice Agent Monorepo

A voice-controlled AI agent with MCP (Model Context Protocol) tool integration for financial analysis and project management.

## Architecture

```
mcp-voice-agent/
├── voice-agent/                    # Main voice agent application
│   ├── src/
│   │   ├── services/
│   │   │   ├── ClaudeService.ts    # Claude LLM provider
│   │   │   ├── OpenAIService.ts    # OpenAI LLM provider
│   │   │   ├── MCPClient.ts        # MCP client for tool integration
│   │   │   ├── LLMFactory.ts       # LLM provider factory
│   │   │   ├── AdaptiveSTTService.ts # GPU-aware speech recognition
│   │   │   ├── HardwareDetectionService.ts # Hardware capability detection
│   │   │   └── FileCleanupService.ts
│   │   ├── routes/
│   │   │   ├── audio.ts            # Unified audio processing endpoint
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
├── docker-compose.yml              # Docker Compose configuration (single container)
├── Dockerfile                      # Docker container definition
├── ecosystem.config.js             # PM2 process management configuration
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

## New Features ✨

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

**Use Cases:**
- **Voice Assistants**: Natural conversation with your financial data
- **Live Analysis**: Real-time financial queries with immediate spoken responses
- **Interactive Sessions**: Extended conversations with context retention
- **Hardware Integration**: Perfect for ESP32, mobile apps, or voice devices

### MCP Realtime Bridge 🌉 **NEW**
The voice agent includes a sophisticated **MCP Realtime Bridge** that seamlessly connects MCP tools with the OpenAI Realtime API:

**Bridge Features:**
- **Automatic Tool Discovery**: Dynamically loads all available MCP tools (currently 12 tools from finance + dev servers)
- **Format Conversion**: Converts MCP tool schemas to OpenAI Realtime API format automatically
- **Argument Parsing**: Handles argument conversion between JSON strings and JavaScript objects
- **Real-time Execution**: Executes MCP tools during live voice conversations
- **Error Handling**: Graceful fallback and error reporting for failed tool calls
- **Session Management**: Configures OpenAI sessions with all available MCP tools

**Technical Implementation:**
```typescript
// MCPRealtimeBridge automatically:
// 1. Discovers tools from MCP servers
const realtimeTools = await bridge.convertMCPToolsToRealtimeFormat();

// 2. Configures OpenAI Realtime session
session.tools = realtimeTools; // 12 tools available

// 3. Handles function calls during conversation
await bridge.executeMCPTool(toolName, args);
```

**Available Tools via Bridge:**
- **Finance Tools (7)**: Amazon transactions, house affordability, retirement planning, etc.
- **Dev Tools (5)**: Project management, database operations, project state tracking, etc.
- **Real-time Execution**: All tools callable during voice conversations
- **Argument Validation**: Proper JSON parsing and validation for tool parameters

### Verbal Response Optimization
The voice agent now automatically optimizes responses based on output format:

**Verbal Responses** (for `/api/audio`):
- Concise, conversational language patterns
- Typically 1-3 sentences for simple queries
- Longer explanations (2-4 sentences) only when:
  - User explicitly asks for detailed analysis
  - Complex financial concepts need clarification
  - Multiple factors require consideration
  - User asks "why" or "how" questions
- Avoids bullet points, lists, complex formatting
- Natural spoken language flow

**Text Responses** (for `/api/text`):
- Detailed formatting with bullet points and lists
- Comprehensive explanations
- Technical precision and thoroughness
- Full structured responses

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

**Structured Logging:**
- Timestamped logs with context
- Error details with stack traces
- Performance and debugging information

### GPU Acceleration with Adaptive STT

The voice agent features **intelligent speech recognition** that automatically optimizes based on available hardware:

**Adaptive Processing:**
- **Local GPU**: Uses NVIDIA hardware when available for 60-80% faster processing
- **Cloud Fallback**: Gracefully falls back to OpenAI Whisper for compatibility
- **Confidence Scoring**: Switches to cloud for low-confidence local transcriptions
- **Hardware Detection**: Automatically detects and optimizes for Jetson devices

## GPU Acceleration (ENHANCED)

The voice agent now supports **automatic GPU acceleration** for Speech-to-Text (STT) processing, providing significant latency improvements on NVIDIA hardware.

### Hardware Support
- **NVIDIA Jetson Devices**: Nano, Xavier, Orin (optimized for edge inference)
- **Desktop/Server GPUs**: RTX, GTX, Tesla, A100, etc.
- **Automatic Detection**: Detects NVIDIA hardware at boot and chooses optimal configuration
- **Fallback Support**: Gracefully falls back to cloud APIs if GPU unavailable

### Performance Improvements
| Component | Current (Cloud) | With GPU | Improvement |
|-----------|----------------|----------|-------------|
| Speech-to-Text | 1-3s + network | 200-500ms | **60-80% faster** |
| Total Audio Pipeline | 5-12s | 1-4s | **60-75% faster** |
| Network Dependency | Required | Optional | **Works offline** |

### Technical Implementation
- **Local Whisper Models**: GPU-optimized OpenAI Whisper models (whisper-small recommended)
- **Adaptive Routing**: Automatically chooses local GPU vs cloud based on hardware detection
- **Confidence Scoring**: Falls back to cloud for low-confidence transcriptions
- **Hybrid Architecture**: Keeps cloud LLMs for complex reasoning, accelerates audio processing locally

### Supported Models
- **whisper-small**: 244M parameters, best speed/accuracy balance for Jetson devices
- **whisper-base**: 74M parameters, fastest inference but lower accuracy
- **whisper-medium**: 769M parameters, highest accuracy but memory intensive

### Usage
```bash
# Check GPU status after deployment
curl http://localhost:3000/api/hardware-status
curl http://localhost:3000/api/stt-status
```

### Hardware Detection
The system automatically detects:
- **NVIDIA GPU presence** via `nvidia-smi`
- **Jetson device type** via device tree model
- **CUDA availability** and version
- **GPU memory capacity** for model selection
- **Docker GPU support** via NVIDIA Container Toolkit

### Requirements for GPU Acceleration
- **NVIDIA GPU** with CUDA support
- **NVIDIA Container Toolkit** for Docker GPU access
- **Sufficient GPU memory**: 2-4GB recommended for whisper-small
- **Docker Compose** with GPU configuration (automatically handled)

### Deployment on Jetson Nano Orin
```bash
# The system will automatically detect Jetson hardware and optimize for:
# - Edge-optimized model selection (whisper-small)
# - Memory-conscious inference
# - Thermal management considerations
# - Local processing for maximum responsiveness

# For Jetson deployment, use Docker Compose:
docker compose up --build -d
# Expected output: "🚀 Jetson device detected: NVIDIA Jetson Nano Orin"
```

## Quick Start

### Prerequisites
- Docker and Docker Compose (recommended)
- OR Node.js 20+ and npm 9+ (for local development)
- OpenAI API key
- Anthropic API key (optional)
- Monarch Money token (optional, for data sync)

### Docker Setup (Recommended)

The Docker setup runs a **single container** with PM2 managing the voice agent process. Choose the right configuration for your environment:

**🔧 Development**: Lightweight build for fast iteration
**🚀 GPU/Jetson**: Full GPU acceleration for production

Both configurations provide:

1. **Voice Agent** (Port 3000) - Main voice interface with WebSocket support **[EXPOSED]**
   - HTTP endpoints: `/api/text`, `/api/audio` 
   - WebSocket endpoint: `/api/audio/realtime` for real-time audio streaming
   - MCP client integration via STDIO communication
   - Health checks and status endpoints

2. **MCP Servers** - On-demand processes spawned via STDIO
   - **Finance MCP**: Financial analysis tools (spawned by voice agent)
   - **Dev Tools MCP**: Project management tools (spawned by voice agent)
   - **STDIO Communication**: Secure, efficient inter-process communication

**Benefits:**
- **Clear Separation**: Development vs GPU deployment paths
- **Fast Development**: No unnecessary GPU packages for dev work
- **Simplified Architecture**: Single communication protocol (STDIO MCP)
- **STDIO Security**: MCP communication via secure channels

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

# Server configuration (all services use port 3000 internally)
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

# Rebuild after code changes
docker compose -f docker-compose.dev.yml down && docker compose -f docker-compose.dev.yml up --build
```

### PM2 Management

Inside the container, PM2 manages the voice agent process:

- View status: `docker compose exec voice-agent pm2 status`
- View logs: `docker compose exec voice-agent pm2 logs`
- Restart voice agent: `docker compose exec voice-agent pm2 restart voice-agent`
- Monitor processes: `docker compose exec voice-agent pm2 monit`

**MCP Server Management:**
- MCP servers are spawned automatically by the voice agent as needed
- No manual process management required for MCP servers
- Communication happens via secure STDIO channels

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

# MCP servers are spawned automatically by voice agent via STDIO
# No manual server startup needed for MCP communication

# Sync financial data from Monarch Money
cd mcp-servers/finance-mcp && MONARCH_TOKEN=your_token npx tsx src/MonarchSync.ts
```

### Production (Without Docker)

```bash
# Build all workspaces
npm run build

# Start voice agent
npm run start:voice
```

### Logs

Service logs are stored in the `./logs` directory and mounted as volumes:
- `voice-agent.log` - Main voice agent logs
- `voice-agent-error.log` - Voice agent error logs
- `voice-agent-out.log` - Voice agent output logs

### Health Checks

The main service includes health checks on port 3000. The voice agent implements comprehensive health monitoring:
- `/health` - Overall service health
- `/api/hardware-status` - GPU and hardware capabilities  
- `/api/stt-status` - Speech-to-text service status

### Troubleshooting

1. **Port conflicts:** Only port 3000 is exposed - change in `docker-compose.yml` if needed
2. **Build issues:** Run `docker compose up --build` to rebuild
3. **Process issues:** Use `./scripts/pm2-status.sh` to check PM2 processes
4. **Clean restart:** `docker compose down && docker compose up --build`
5. **MCP communication issues:** Check voice agent logs for STDIO connection errors

## Jetson Deployment

### 🎯 Why Jetson Hybrid GPU Deployment?

We use a **hybrid deployment strategy** that combines the best of both worlds:

**Problem We're Solving:**
- ❌ **Native Jetson deployment**: PyTorch can't detect CUDA properly
- ❌ **Full Docker builds**: Take 2+ hours due to slow ARM compilation
- ❌ **Cross-platform builds**: 30% success rate due to native dependencies

**Our Solution: Hybrid GPU Containers**
- ✅ **GPU access**: Use proven `dustynv/l4t-pytorch:r36.4.0` base image
- ✅ **Fast development**: Build once (25 min), iterate fast (30 sec)
- ✅ **No cross-compilation**: Dependencies built natively on Jetson ARM
- ✅ **Container benefits**: Isolation, GPU runtime, reproducibility

**Expected Performance Improvement:**
- **STT processing**: 2-5s (cloud) → 1-3s (local GPU) = **2-3x faster**
- **Total voice-to-voice**: ~60s → ~15-30s = **50% improvement**

### 📋 Prerequisites

- Jetson Orin with JetPack 6.1 (L4T R36.4.3)
- Docker with GPU runtime configured
- SSH access to Jetson
- ~25GB free space on Jetson

### 🚀 Three-Stage Deployment Strategy

> **🖥️ IMPORTANT: All scripts run on your Mac, not on the Jetson**  
> The scripts use SSH to execute commands remotely on the Jetson

#### Stage 1: Bootstrap (One-Time Setup)
**Purpose:** Initial Jetson system setup with dependencies  
**Run from:** Your Mac (executes on Jetson via SSH)
```bash
./scripts/jetson-bootstrap.sh
```

**What it does:**
- Installs Node.js 20 LTS
- Updates Docker and NVIDIA Container Toolkit
- Configures system dependencies
- Tests GPU access and Docker integration
- Prepares Jetson for voice agent deployment

#### Stage 2: Setup (25 minutes)
**Purpose:** Initial voice agent setup with ARM dependency builds  
**Run from:** Your Mac (executes on Jetson via SSH)
```bash
./scripts/jetson-setup-slow.sh
```

**What it does:**
- Validates Jetson prerequisites (GPU, Docker, disk space)
- Transfers project files via rsync
- **Builds ARM dependencies natively** (the expensive 20-25 minute part)
- Sets up GPU container with dustynv/l4t-pytorch base image
- Creates monitoring and reference scripts
- Marks setup as complete for fast deployments

#### Stage 3: Deploy (30 seconds)
**Purpose:** Regular deployment for code changes  
**Run from:** Your Mac (executes on Jetson via SSH)
```bash
./scripts/jetson-deploy-fast.sh
```

**What it does:**
- Checks that setup was completed (fails fast if not)
- Syncs code changes (excludes pre-built node_modules)
- Builds TypeScript using existing ARM dependencies  
- Restarts GPU container
- Verifies deployment health

### Clear Workflow

```bash
# ALL COMMANDS RUN FROM YOUR MAC (not on Jetson)

# Bootstrap (one-time system setup)
./scripts/jetson-bootstrap.sh       # 5 minutes

# Initial setup (one-time dependency build)
./scripts/jetson-setup-slow.sh       # 25 minutes

# Regular development (many times)
./scripts/jetson-deploy-fast.sh      # 30 seconds
./scripts/jetson-deploy-fast.sh      # 30 seconds  
./scripts/jetson-deploy-fast.sh      # 30 seconds

# When dependencies change (rare)
./scripts/jetson-setup-slow.sh       # 25 minutes
```

### 🔄 Development Workflow

**Daily Development Cycle:**
1. **Edit code** on Mac (VS Code, full IDE support)
2. **Deploy changes** from Mac: `./scripts/jetson-deploy-fast.sh` (30 seconds)
3. **Test immediately**: Voice agent available at https://192.168.1.108
4. **Monitor/debug**: SSH to Jetson for monitoring scripts

**When to Re-run Setup:**
- Added/removed npm packages (package.json changed)
- Node.js version updates
- Need clean environment
- Initial deployment

**Never Need Setup Again For:**
- Code changes (TypeScript, JavaScript)
- Configuration changes (environment variables)
- Debugging and restarts
- UI modifications

### 🛠️ Usage Instructions

**Initial Deployment:**
```bash
# ON YOUR MAC: Clone project and configure environment
git clone https://github.com/yourusername/mcp-voice-agent.git && cd mcp-voice-agent
cp .env.example .env  # Configure API keys

# ON YOUR MAC: Bootstrap Jetson system (5 minutes)
./scripts/jetson-bootstrap.sh

# ON YOUR MAC: One-time voice agent setup (25 minutes)
./scripts/jetson-setup-slow.sh

# Expected output:
# 🏗️ Jetson GPU Setup (One-time, 25 minutes)
# Target: nvidia@192.168.1.108
# [Progress indicators...]
# ✅ Setup complete! Use jetson-deploy-fast.sh for regular development
```

**Regular Development:**
```bash
# ON YOUR MAC: Make code changes
# ON YOUR MAC: Deploy to Jetson (30 seconds)
./scripts/jetson-deploy-fast.sh

# Expected output:
# 🚀 Fast Jetson deployment (~30 seconds)
# ✅ Deployment complete in 25 seconds!
# 🌐 Voice agent: https://192.168.1.108
```

### 📊 Performance Analysis

**Time Investment:**
| **Operation** | **Frequency** | **Duration** |
|---------------|---------------|--------------|
| Bootstrap | Once | 5 minutes |
| Initial setup | Once | 25 minutes |
| Dependency updates | Weekly | 25 minutes |
| Code deployments | Daily | 30 seconds |

**Expected Performance:**
- **STT Processing**: 1-3 seconds (vs 2-5s cloud) = **2-3x faster**
- **Development cycles**: 30 seconds (vs 20+ minutes rebuild)
- **GPU utilization**: 20-40% during voice processing
- **Memory usage**: ~2GB (container + PyTorch + models)

### 🔧 Troubleshooting

**Common Issues:**

**Setup Script Fails:**
```bash
# Check prerequisites
ssh nvidia@192.168.1.108 'nvidia-smi && docker --version && df -h'

# Check network connectivity  
ping 192.168.1.108

# Retry setup (safe to re-run)
./scripts/jetson-setup-slow.sh
```

**Deploy Script Fails:**
```bash
# Check if setup was completed
ssh nvidia@192.168.1.108 'test -f voice-agent-gpu/.setup-complete && echo "Setup OK" || echo "Run setup first"'

# Check container status
ssh nvidia@192.168.1.108 'docker ps | grep voice-agent-gpu'

# Re-run deployment
./scripts/jetson-deploy-fast.sh
```

**GPU Not Working:**
```bash
# Test GPU access in container
ssh nvidia@192.168.1.108 'docker exec voice-agent-gpu_voice-agent-gpu_1 python3 -c "import torch; print(torch.cuda.is_available())"'

# Should output: True
```

## API Endpoints

### Voice Agent Server (Port 3000 - External Access)

#### WebSocket /api/audio/realtime 🎙️ **NEW - REAL-TIME STREAMING**
Real-time speech-to-speech conversation endpoint via WebSocket for instant voice interactions.

**Connection:**
- Protocol: WebSocket
- URL: `ws://localhost:3000/api/audio/realtime`
- Format: Real-time audio streaming with JSON control messages

**Features:**
- **Real-time Streaming**: Bidirectional audio streaming
- **Live Transcription**: Real-time text as you speak
- **Voice Activity Detection**: Automatic speech detection
- **MCP Tool Integration**: Real-time tool execution
- **Natural Conversation**: Support for interruptions and context

**Usage:**
```javascript
// Connect to realtime audio WebSocket
const ws = new WebSocket('ws://localhost:3000/api/audio/realtime');

// Send audio chunks (base64 encoded PCM16 24kHz)
ws.send(JSON.stringify({
  type: 'audio_chunk',
  audio: base64AudioData
}));

// Receive real-time responses
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'audio_delta') {
    // Play audio chunk immediately
    playAudioChunk(data.audio);
  }
};
```

**Test Client:**
Open `voice-agent/test-realtime-client.html` in browser for interactive testing.

#### POST /api/audio ✨ **ENHANCED - UNIFIED ENDPOINT**
Traditional audio endpoint for complete audio-to-audio processing. File-based alternative to real-time streaming.

**Request:**
- Method: POST  
- Content-Type: multipart/form-data
- Body: audio file (WAV, MP3, M4A, etc.)

**Response:**
- Content-Type: audio/mpeg
- Body: MP3 audio file (AI-generated speech response optimized for verbal delivery)
- Headers:
  - `X-Transcription`: URL-encoded transcription of input audio
  - `X-Tools-Used`: Comma-separated list of tools used

**Features:**
- **Adaptive STT**: GPU-aware speech recognition with cloud fallback
- **Verbal LLM**: Responses optimized for spoken delivery
- **Hardware Agnostic**: Works with ESP32, web, and any audio-capable device

**Usage:**
```bash
# Send audio and receive optimized audio response
curl -X POST \
  -F "audio=@input.wav" \
  http://localhost:3000/api/audio \
  --output response.mp3
```

#### POST /api/text  
Process text input directly with detailed formatting.

**Request:**
```json
{
  "text": "How much did I spend on groceries last month?"
}
```

**Response:**
```json
{
  "response": "You spent $348.76 on groceries last month...",
  "toolsUsed": ["query_finance_database"]
}
```

#### GET /health
Health check endpoint.

#### GET /api/hardware-status ✨ **NEW**
Get hardware detection and GPU capabilities.

**Response:**
```json
{
  "hardwareInfo": {
    "hasNvidiaGPU": true,
    "isJetsonDevice": true,
    "gpuMemory": "4GB"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### GET /api/stt-status ✨ **NEW**
Get speech-to-text service status and configuration.

**Response:**
```json
{
  "hardwareInfo": {...},
  "localSTTAvailable": true,
  "activeStrategy": "Local with Cloud Fallback",
  "health": {
    "overall": true,
    "local": true,
    "cloud": true
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### MCP Tools Integration

The voice agent communicates with MCP servers via STDIO protocol for secure, efficient tool execution. All financial and development tools are available through natural language queries to the voice agent.

**Available via Voice/Text API:**
- **Finance Tools**: Database queries, house affordability analysis, Monarch sync, Amazon imports
- **Project Tools**: Project management, creation, navigation, and deletion
- **Real-time Execution**: All tools available during real-time voice conversations

## Testing

### Docker-based Testing (Recommended)

```bash
# Start the services
docker compose up -d --build

# Test real-time audio streaming (interactive browser test)
open voice-agent/test-realtime-client.html
# Or navigate to: file:///path/to/voice-agent/test-realtime-client.html
# 1. Click "Connect" to establish WebSocket connection
# 2. Click "Start Recording" and speak naturally
# 3. Receive live transcription and audio responses
# 4. Test MCP tool integration: "What's my project status?" or "Show my expenses"

# Test unified audio endpoint (returns optimized audio response)
curl -X POST \
  -F "audio=@voice-agent/tests/audio/house-affordability.wav" \
  http://localhost:3000/api/audio \
  --output response.mp3

# Test text endpoint (returns detailed text response)
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"text": "What are my monthly expenses?"}' \
  http://localhost:3000/api/text

# Test project management
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"text": "list my projects"}' \
  http://localhost:3000/api/text

# Check hardware capabilities
curl http://localhost:3000/api/hardware-status

# Check STT service status
curl http://localhost:3000/api/stt-status

# Health check
curl http://localhost:3000/health
```

### Real-time Audio Testing 🎙️ **NEW**

**Interactive Testing:**
1. **Open Test Client**: Navigate to `voice-agent/test-realtime-client.html` in your browser
2. **Connect**: Click "Connect" to establish WebSocket connection
3. **Start Recording**: Click "Start Recording" and grant microphone access
4. **Speak Naturally**: Ask questions like:
   - "What's my current project status?"
   - "How much did I spend on groceries last month?"
   - "Can I afford a $400,000 house?"
5. **Live Response**: See real-time transcription and hear immediate audio responses
6. **Tool Integration**: Watch MCP tools execute in real-time with live results

**Expected Flow:**
```
You: "What's my project status?"
→ Live transcription appears instantly
→ AI responds: "Let me check your current projects..."
→ MCP tool executes: list_projects
→ AI continues: "You have 3 active projects: Project Alpha created yesterday..."
→ Audio streams back in real-time
```

**WebSocket Message Types:**
- `session_ready`: Connection established
- `speech_started`/`speech_stopped`: Voice activity detection
- `transcript_delta`: Live transcription text
- `audio_delta`: Streaming audio response chunks
- `error`: Error messages and debugging info

### Sample Audio Test

The repository includes test audio files for validation:

```bash
# Test audio endpoint with sample file
curl -X POST \
  -F "audio=@voice-agent/tests/audio/house-affordability.wav" \
  http://localhost:3000/api/audio \
  --output house-affordability-response.mp3

# Expected: Comprehensive house affordability analysis optimized for spoken delivery
# Response will be concise, conversational audio suitable for voice assistant playback
```

### Error Handling Validation

Test the standardized error responses:

```bash
# Test validation error
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"invalid": "data"}' \
  http://localhost:3000/api/text

# Expected response (400):
# {
#   "error": "Missing or invalid text field",
#   "code": "VALIDATION_ERROR",
#   "timestamp": "2024-01-01T12:00:00.000Z"
# }

# Test with invalid audio file
curl -X POST \
  -F "audio=@invalid.txt" \
  http://localhost:3000/api/audio

# Expected response (400):
# {
#   "error": "Invalid audio format...",
#   "code": "VALIDATION_ERROR",
#   "timestamp": "2024-01-01T12:00:00.000Z"
# }
```

## Process Management

The Docker setup uses **PM2 for process management** within the single container:

**PM2 Configuration** (`ecosystem.config.js`):
- **voice-agent**: Main API server (port 3000) with MCP client integration

**PM2 Commands in Container:**
```bash
# View process status
docker compose exec voice-agent pm2 status

# View logs
docker compose exec voice-agent pm2 logs

# Restart voice agent
docker compose exec voice-agent pm2 restart voice-agent

# Monitor processes
docker compose exec voice-agent pm2 monit
```

**MCP Server Communication:**
- MCP servers are spawned on-demand via STDIO by the voice agent
- No persistent HTTP servers needed for MCP communication
- Automatic process management through MCP client lifecycle

## Security Features

### Container Security
- **Port Isolation**: Only voice agent (port 3000) exposed externally
- **STDIO Communication**: MCP servers communicate via secure STDIO channels, not network
- **Process Isolation**: PM2 manages isolated processes within the container
- **No Internal HTTP**: No internal HTTP servers reduce attack surface

### Read-Only Database Access
The finance MCP server implements read-only database security for external queries:
- SQL queries via MCP tools are restricted to SELECT statements only
- Write operations (INSERT, UPDATE, DELETE, etc.) are blocked
- Database integrity is protected from external access

### Query Validation
- Only SELECT statements are allowed through the query endpoint
- Forbidden keywords (INSERT, UPDATE, DELETE, etc.) are rejected
- Parameter binding prevents SQL injection attacks

### Error Handling Security
- **Sensitive Information Protection**: Error messages don't expose internal details
- **Rate Limiting Ready**: Structured error codes enable external rate limiting
- **Audit Trail**: All errors logged with context for security monitoring

## Data Import and Sync

### Monarch Money Integration
Import live financial data from Monarch Money:

```bash
# Docker environment
docker compose exec voice-agent sh -c "cd /app && MONARCH_TOKEN=your_token npx tsx mcp-servers/finance-mcp/src/MonarchSync.ts"

# Local environment  
cd mcp-servers/finance-mcp
MONARCH_TOKEN=your_token npx tsx src/MonarchSync.ts
```

**Sync Behavior:**
- **Accounts**: Balances are updated/overwritten with current values
- **Transactions**: Only new transactions are added (no duplicates)
- **Safe to re-run**: Multiple syncs won't create duplicate data

**Data Imported:**
- Account information and current balances
- Transaction history with categories
- Account metadata and types

### Amazon Transaction Import ✅ **IMPLEMENTED & WORKING**
Import comprehensive Amazon transaction data from CSV export files:

**Features:**
- **Physical Orders**: 3,646+ order items (multi-item order support)
- **Returns & Refunds**: Order logistics and actual refund payments
- **Digital Purchases**: E-books, music, movies, apps (491+ transactions)
- **Rentals**: Amazon rental services
- **Concessions**: Customer service credits and replacements
- **Total Import**: ~5,450+ transactions representing $87K+ activity
- **Financial Accuracy**: Proper accounting (purchases negative, refunds positive)

**Setup:**
1. Go to [Amazon Account & Login Info](https://www.amazon.com/gp/privacyprefs/manager)
2. Request "Your Orders" data export  
3. Download and extract to accessible location

**Usage via MCP Tools:**
```bash
# Import all Amazon data (orders, returns, rentals, digital, concessions)
curl -X POST http://localhost:3000/api/text \
  -H "Content-Type: application/json" \
  -d '{"text": "Import Amazon data from /path/to/Your Orders"}'

# Query recent Amazon activity
curl -X POST http://localhost:3000/api/text \
  -H "Content-Type: application/json" \
  -d '{"text": "What did I buy on Amazon last month?"}'

# Get Amazon spending summary
curl -X POST http://localhost:3000/api/text \
  -H "Content-Type: application/json" \
  -d '{"text": "What was my total Amazon spending in 2024?"}'
```

**Key Features:**
- **Advanced CSV Parsing**: Handles complex Amazon formats, BOM characters, embedded quotes
- **Multi-item Order Support**: Separate records for each item using `orderID_asin` unique keys  
- **Date Fallback Logic**: Historical date fallbacks for missing order lookups
- **Duplicate Prevention**: Prevents duplicate imports by transaction ID
- **Token Limit Optimization**: Historical date assignment prevents fake "recent" transactions
- **Financial Accuracy**: Proper accounting with net spending calculations

## MCP Tools

### Finance MCP Tools

#### query_finance_database
Execute SQL queries on the financial database.
- Input: `{ query: string, params?: any[] }`
- Returns: Query results with row count

#### get_database_schema  
Get database table information.
- Input: `{ table_name?: string }`
- Returns: Table schemas and column definitions

#### house_affordability_analysis
Calculate house affordability based on financial data.
- Input: `{}`  
- Returns: Affordability analysis with recommendations

#### sync_monarch_data
Sync latest data from Monarch Money.
- Input: `{ token?: string }`
- Returns: Sync results and statistics

#### import_amazon_data
Import Amazon transaction data from CSV export files.
- Input: `{ data_path?: string }` (defaults to `~/Downloads/Your Orders`)
- Returns: Import summary with orders, returns, and rentals processed

#### list_amazon_transactions
List Amazon transactions with filtering options.
- Input: `{ transaction_type?: string, days_back?: number, status_filter?: string }`
- Returns: Filtered Amazon transactions with summary statistics

### Dev Tools MCP Tools

#### list_projects
List all projects with current status.
- Input: `{}`
- Returns: Array of projects with metadata

#### create_project
Create a new project.
- Input: `{ name: string }`
- Returns: Created project information

#### enter_project
Enter/activate a project by name or ID.
- Input: `{ identifier: string | number }`
- Returns: Project information and success status

#### leave_project
Leave the currently active project.
- Input: `{}`
- Returns: Success status

#### delete_project
Delete a project by name or ID.
- Input: `{ identifier: string | number }`
- Returns: Success status

## Database Schema

### Finance Database (finance.db)
The SQLite database contains financial data with the following main tables:

- **accounts**: Bank accounts, balances, types, metadata
- **transactions**: Financial transactions with categories and descriptions
- **stock_options**: Stock option grants and valuations (if applicable)
- **amazon_transactions**: Amazon orders, returns, and rentals with financial accounting
- **amazon_import_log**: Import history and statistics for Amazon data

### Dev Tools Database (projects.db)
The SQLite database contains project management data:

- **projects**: Project information with creation/update timestamps

### Sample Data Statistics
After Monarch import:
- **Accounts**: 64 accounts with current balances
- **Transactions**: 23,545+ historical transactions with categories
- **Data Integrity**: All transactions have unique IDs, no duplicates

## Development Notes

### Container Architecture Benefits

The single-container architecture provides several advantages:

1. **Simplicity**: Unified deployment with single container management
2. **Efficiency**: Direct STDIO communication eliminates HTTP overhead
3. **Resource Optimization**: Lower memory footprint and fewer processes
4. **Consistency**: Matches Jetson deployment architecture for universal compatibility
5. **Security**: Reduced attack surface with no internal HTTP servers

### Adding New MCP Tools

1. Create tool in appropriate MCP server (`mcp-servers/*/src/index.ts`)
2. Add tool to `ListToolsRequestSchema` handler
3. Implement tool logic in `CallToolRequestSchema` handler  
4. Update `MCPClient.ts` in voice-agent if needed

### Adding New LLM Providers

1. Create service class implementing `LLMProvider` interface
2. Add provider to `LLMFactory.ts`
3. Update environment variable handling

### Error Handling Standards

The project now uses standardized error handling:

1. **Use error utilities**: Import from `utils/errorUtils.ts`
2. **Structured logging**: Use `utils/logger.ts` for consistent formatting
3. **Proper classification**: Validation vs External API vs System errors
4. **Standard responses**: All endpoints return consistent error format

### Database Security

The HTTP servers implement multiple security layers:
- Read-only database connections prevent writes
- Query validation blocks dangerous SQL keywords
- Parameter binding prevents SQL injection
- Only SELECT statements are permitted

## Troubleshooting

### Common Issues

1. **Audio upload fails**: Check file format and size (max 25MB)
2. **Database errors**: Ensure databases exist in `data/` directory
3. **MCP connection issues**: Verify MCP servers are running and accessible
4. **API key errors**: Check environment variables are set correctly
5. **Monarch sync fails**: Verify MONARCH_TOKEN is valid and has proper permissions
6. **Container startup issues**: Check Docker logs and PM2 process status
7. **GPU detection fails**: Check NVIDIA drivers and Container Toolkit installation
8. **STT errors**: Check `/api/stt-status` and `/api/hardware-status` for diagnostics

### Debugging

Enable debug logging:
```bash
DEBUG=* npm run dev
```

View container logs:
```bash
# Container logs
docker compose logs -f

# Specific service logs
docker compose logs -f voice-agent
```

Check service status:
```bash
# Hardware capabilities
curl http://localhost:3000/api/hardware-status

# STT service health
curl http://localhost:3000/api/stt-status

# Overall health
curl http://localhost:3000/health
```

### Performance Monitoring

Monitor GPU usage during audio processing:
```bash
# NVIDIA GPU monitoring
nvidia-smi -l 1

# Container resource usage
docker stats

# Voice agent process monitoring
docker compose exec voice-agent pm2 monit
```

## Recent Updates ✨

### Version 2.0 Features

**Enhanced Audio Processing:**
- Unified `/api/audio` endpoint replacing dual endpoints
- Adaptive STT with GPU acceleration and cloud fallback
- Verbal response optimization for natural speech delivery
- Hardware-aware processing with automatic optimization

**Improved Reliability:**
- Standardized error handling across all endpoints
- Structured logging with context and timestamps
- Proper HTTP status codes and error classification
- Enhanced debugging capabilities

**Better Performance:**
- 60-80% faster speech processing with GPU acceleration
- Confidence-based routing for optimal accuracy
- Reduced network dependency with local processing
- Optimized for edge devices like Jetson Nano

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License - see LICENSE file for details.