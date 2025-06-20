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
│   │   │   └── FileCleanupService.ts
│   │   ├── routes/
│   │   │   ├── audio.ts            # Voice/audio processing endpoint
│   │   │   ├── audio-esp32.ts      # ESP32-optimized audio endpoint
│   │   │   └── text.ts             # Text processing endpoint
│   │   └── index.ts                # Main application entry point
│   ├── tests/                      # Test files and audio samples
│   └── package.json
├── mcp-servers/                    # MCP tool servers
│   ├── finance-mcp/                # Financial data and analysis tools
│   │   ├── src/
│   │   │   ├── index.ts            # MCP server implementation
│   │   │   ├── http-server.ts      # Direct HTTP API server (read-only)
│   │   │   ├── MonarchSync.ts      # Monarch Money data import
│   │   │   ├── analysis/           # Financial analysis modules
│   │   │   └── importers/          # Data import utilities (CSV, Amazon, etc.)
│   │   └── package.json
│   └── dev-tools-mcp/              # Development and project management tools
│       ├── src/
│       │   ├── index.ts            # MCP server implementation
│       │   └── http-server.ts      # HTTP API server for projects
│       └── package.json
├── data/
│   ├── finance.db                  # SQLite database with financial data  
│   └── projects.db                 # SQLite database with project data
├── docker-compose.yml              # Docker Compose configuration (3 containers)
├── Dockerfile                      # Docker container definition
├── ecosystem.config.js             # PM2 process management (voice agent only)
├── mcp-config.json                 # MCP server registry
└── package.json                    # Root monorepo configuration
```

## Container Architecture

The application uses Docker Compose with **3 separate containers** for clean service isolation:

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Voice Agent       │    │   Finance API       │    │   Dev Tools API     │
│   Container         │    │   Container         │    │   Container         │
│                     │    │                     │    │                     │
│ ┌─────────────────┐ │    │ ┌─────────────────┐ │    │ ┌─────────────────┐ │
│ │ Voice Agent     │ │    │ │ Finance HTTP    │ │    │ │ Dev Tools HTTP  │ │
│ │ (Port 3000)     │ │    │ │ (Port 3000)     │ │    │ │ (Port 3000)     │ │
│ │                 │ │    │ │ - SQL Queries   │ │    │ │ - Projects CRUD │ │
│ │ - Text API      │ │    │ │ - Account Info  │ │    │ │ - Project State │ │
│ │ - Audio API     │ │    │ │ - Transactions  │ │    │ │ - SQLite DB     │ │
│ │ - MCP Client    │ │    │ │ - Analysis      │ │    │ │                 │ │
│ │ - ESP32 Support │ │    │ │ - Read-Only DB  │ │    │ │                 │ │
│ └─────────────────┘ │    │ └─────────────────┘ │    │ └─────────────────┘ │
└─────────┬───────────┘    └─────────────────────┘    └─────────────────────┘
          │                                                                   
       External                          Internal Only         Internal Only  
    localhost:3000                    (No external ports)    (No external ports)
```

**Key Benefits:**
- **Security**: Only voice agent exposed externally
- **Isolation**: Each service runs in its own container
- **Scalability**: Services can be scaled independently
- **Maintenance**: Clean separation of concerns

## Features

### Voice Agent
- **Speech-to-Text**: Audio file upload and transcription using OpenAI Whisper
- **Text-to-Speech**: AI response generation with OpenAI TTS (for ESP32)
- **Text Processing**: Direct text input processing  
- **Multi-LLM Support**: Claude 3.5 Sonnet and GPT-4 support
- **MCP Integration**: Tool calling via Model Context Protocol
- **Dual Audio Endpoints**: ESP32-optimized (returns audio) and debug (returns JSON)
- **RESTful API**: Express.js server with audio and text endpoints

### Finance MCP Server
- **MCP Tools**: SQL queries, schema inspection, financial analysis via MCP protocol
- **HTTP API Server**: Direct REST API access with read-only database security
- **Monarch Money Integration**: Live financial data import and sync
- **Amazon Import**: Import Amazon order history, returns, and rentals from CSV exports
- **Database Queries**: Secure SQL query execution with write protection
- **Schema Inspection**: Database table and column information
- **House Affordability Analysis**: Comprehensive affordability calculations
- **Account Management**: Balance and transaction analysis

### Dev Tools MCP Server
- **Project Management**: Create, list, enter, and delete projects
- **Project State**: Track current active project across sessions
- **SQLite Storage**: Persistent project data with timestamps
- **RESTful API**: Direct HTTP access for project operations
- **MCP Integration**: Project tools available via MCP protocol

## GPU Acceleration (NEW)

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
# Automatic GPU deployment (detects hardware and configures appropriately)
./scripts/deploy-with-gpu.sh

# Force GPU-only deployment (fails if no GPU detected)
./scripts/deploy-with-gpu.sh --gpu-only

# Force CPU-only deployment (uses cloud APIs only)
./scripts/deploy-with-gpu.sh --cpu-only

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

./scripts/deploy-with-gpu.sh
# Expected output: "🚀 Jetson device detected: NVIDIA Jetson Nano Orin"
```

## Quick Start

### Prerequisites
- Docker and Docker Compose (recommended)
- OR Node.js 18+ and npm 9+ (for local development)
- OpenAI API key
- Anthropic API key (optional)
- Monarch Money token (optional, for data sync)

### Docker Setup (Recommended)

The application uses Docker Compose with **3 separate containers** for optimal service isolation:

```bash
# Clone the repository
git clone <repo-url>
cd mcp-voice-agent

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys (see Environment Variables section below)

# Build and start with Docker Compose
docker compose up --build

# Or run in detached mode
docker compose up -d --build
```

**Container Services:**
- **mcp-voice-agent**: Main voice agent (port 3000, externally exposed)
- **finance-api**: Finance HTTP server (port 3000, internal only)
- **dev-tools-api**: Dev tools HTTP server (port 3000, internal only)

**Security**: Only the main voice agent (port 3000) is exposed externally. All other services run internally for security.

### Local Development Setup

```bash
# Clone and install dependencies
git clone <repo-url>
cd mcp-voice-agent
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys
```

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
# Build and start all services
docker compose up --build

# Start in background
docker compose up -d --build

# View logs from all containers
docker compose logs -f

# View logs from specific container
docker compose logs -f mcp-voice-agent
docker compose logs -f finance-api
docker compose logs -f dev-tools-api

# Access container shell
docker compose exec mcp-voice-agent /bin/bash

# Stop services
docker compose down

# Rebuild after code changes
docker compose down && docker compose up --build
```

### Local Development (Without Docker)

```bash
# Start voice agent in development mode
npm run dev

# Start finance MCP server (MCP protocol)
npm run dev:finance-mcp

# Start dev tools MCP server (MCP protocol)  
npm run dev:dev-tools-mcp

# Start finance HTTP server (direct API access)
cd mcp-servers/finance-mcp && npm run start:http

# Start dev tools HTTP server (direct API access)
cd mcp-servers/dev-tools-mcp && npm run start:http

# Sync financial data from Monarch Money
cd mcp-servers/finance-mcp && MONARCH_TOKEN=your_token npx tsx src/MonarchSync.ts
```

### Production

```bash
# Build all workspaces
npm run build

# Start voice agent
npm run start:voice

# Start MCP servers
npm run start:finance-mcp
npm run start:dev-tools-mcp
```

## API Endpoints

### Voice Agent Server (Port 3000 - External Access)

#### POST /api/audio
Main audio endpoint for ESP32-S3 devices. Returns audio response.

**Request:**
- Method: POST  
- Content-Type: multipart/form-data
- Body: audio file (WAV, MP3, M4A, etc.)

**Response:**
- Content-Type: audio/mpeg
- Body: MP3 audio file (AI-generated speech response)
- Headers:
  - `X-Transcription`: URL-encoded transcription of input audio
  - `X-Tools-Used`: Comma-separated list of tools used

**Usage:**
```bash
# Send audio and receive audio response
curl -X POST \
  -F "audio=@input.wav" \
  http://localhost:3000/api/audio \
  --output response.mp3
```

#### POST /api/audioDebug
Debug audio endpoint for development. Returns JSON with detailed information.

**Request:**
- Method: POST  
- Content-Type: multipart/form-data
- Body: audio file (WAV, MP3, M4A, etc.)

**Response:**
```json
{
  "transcription": "What's my account balance?",
  "response": "Your checking account has $2,450.32 and savings has $15,670.89", 
  "toolsUsed": ["query_finance_database"]
}
```

#### POST /api/text  
Process text input directly.

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

### Finance HTTP Server (Internal Only)

Direct REST API access to financial data with read-only security.

#### POST /api/query
Execute read-only SQL queries on financial database.

#### GET /api/accounts
Get account balances and information.

#### GET /api/spending?months=1
Get spending by category for specified months.

#### GET /api/transactions?days=7&limit=20
Get recent transactions.

#### GET /api/large-expenses?threshold=100&days=30
Get large expenses above threshold.

#### GET /api/cash-flow?days=30
Get income vs expenses analysis.

#### GET /api/options
Get stock options portfolio information.

#### GET /api/retirement
Get tax-aware retirement analysis.

#### GET /api/house-affordability
Get comprehensive house affordability analysis.

#### GET /api/schema
Get database schema information.

#### GET /health
Health check endpoint.

### Dev Tools HTTP Server (Internal Only)

Direct REST API access for project management.

#### GET /api/projects
List all projects.

#### POST /api/projects
Create a new project.
```json
{"name": "project-name"}
```

#### GET /api/projects/current
Get currently active project.

#### POST /api/projects/current
Enter/activate a project.
```json
{"identifier": "name-or-id"}
```

#### DELETE /api/projects/current
Leave current project.

#### DELETE /api/projects/{id}
Delete project by ID.

## Testing

### Docker-based Testing (Recommended)

```bash
# Start the services
docker compose up -d --build

# Test ESP32 audio endpoint (returns audio response)
curl -X POST \
  -F "audio=@voice-agent/tests/audio/house-affordability.wav" \
  http://localhost:3000/api/audio \
  --output response.mp3

# Test debug audio endpoint (returns JSON response)
curl -X POST \
  -F "audio=@voice-agent/tests/audio/house-affordability.wav" \
  http://localhost:3000/api/audioDebug

# Test text endpoint
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"text": "What are my monthly expenses?"}' \
  http://localhost:3000/api/text

# Test project management
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"text": "list my projects"}' \
  http://localhost:3000/api/text

# Health check
curl http://localhost:3000/health
```

### Sample Audio Test

The repository includes test audio files for validation:

```bash
# Test ESP32 audio endpoint (get audio response)
curl -X POST \
  -F "audio=@voice-agent/tests/audio/house-affordability.wav" \
  http://localhost:3000/api/audio \
  --output house-affordability-response.mp3

# Test debug endpoint (get JSON response)
curl -X POST \
  -F "audio=@voice-agent/tests/audio/house-affordability.wav" \
  http://localhost:3000/api/audioDebug

# Expected: Comprehensive house affordability analysis with real financial data
# ESP32 endpoint returns audio file, debug endpoint returns JSON with transcription
```

## Process Management

The Docker setup uses a **simplified PM2 configuration** that only manages the voice agent:

**PM2 Configuration** (`ecosystem.config.js`):
- **voice-agent**: Main API server (port 3000)

**PM2 Commands in Container:**
```bash
# View process status
docker compose exec mcp-voice-agent pm2 status

# View logs
docker compose exec mcp-voice-agent pm2 logs

# Restart voice agent
docker compose exec mcp-voice-agent pm2 restart voice-agent

# Monitor processes
docker compose exec mcp-voice-agent pm2 monit
```

## Security Features

### Container Security
- **Port Isolation**: Only main voice agent (port 3000) exposed externally
- **Service Isolation**: Each service runs in separate containers
- **Internal Communication**: Finance and dev-tools APIs accessible only within Docker network
- **Process Isolation**: Clean separation of concerns across containers

### Read-Only Database Access
The finance HTTP server uses `SQLITE_OPEN_READONLY` mode to prevent any write operations:
- SQL queries are restricted to SELECT statements only
- Write operations (INSERT, UPDATE, DELETE, etc.) are blocked
- Database integrity is protected from API access

### Query Validation
- Only SELECT statements are allowed through the query endpoint
- Forbidden keywords (INSERT, UPDATE, DELETE, etc.) are rejected
- Parameter binding prevents SQL injection attacks

## Data Import and Sync

### Monarch Money Integration
Import live financial data from Monarch Money:

```bash
# Docker environment
docker compose exec finance-api sh -c "cd /app && MONARCH_TOKEN=your_token npx tsx mcp-servers/finance-mcp/src/MonarchSync.ts"

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

The 3-container architecture provides several advantages:

1. **Security**: Only the voice agent is exposed externally
2. **Isolation**: Services can't interfere with each other
3. **Scalability**: Each service can be scaled independently
4. **Debugging**: Easier to debug individual services
5. **Maintenance**: Clean separation makes updates safer

### Adding New MCP Tools

1. Create tool in appropriate MCP server (`mcp-servers/*/src/index.ts`)
2. Add tool to `ListToolsRequestSchema` handler
3. Implement tool logic in `CallToolRequestSchema` handler  
4. Update `MCPClient.ts` in voice-agent if needed

### Adding New LLM Providers

1. Create service class implementing `LLMProvider` interface
2. Add provider to `LLMFactory.ts`
3. Update environment variable handling

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
6. **Container connection issues**: Ensure Docker Compose network is working

### Debugging

Enable debug logging:
```bash
DEBUG=* npm run dev
```

View container logs:
```bash
# All containers
docker compose logs -f

# Specific container
docker compose logs -f mcp-voice-agent
docker compose logs -f finance-api
docker compose logs -f dev-tools-api
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License - see LICENSE file for details. 