# MCP Voice Agent Monorepo

A voice-controlled AI agent with MCP (Model Context Protocol) tool integration for financial analysis and management.

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
│   │   │   └── text.ts             # Text processing endpoint
│   │   └── index.ts                # Main application entry point
│   ├── tests/                      # Test files
│   └── package.json
├── mcp-servers/                    # MCP tool servers
│   ├── finance-mcp/                # Financial data and analysis tools
│   │   ├── src/
│   │   │   ├── index.ts            # MCP server implementation
│   │   │   ├── http-server.ts      # Direct HTTP API server (read-only)
│   │   │   ├── MonarchSync.ts      # Monarch Money data import
│   │   │   ├── analysis/           # Financial analysis modules
│   │   │   └── importers/          # Data import utilities
│   │   └── package.json
│   ├── voice-mcp/                  # Voice processing tools
│   │   ├── src/index.ts
│   │   └── package.json
│   └── dev-tools-mcp/              # Development tools (future)
├── data/
│   └── finance.db                  # SQLite database with financial data
├── mcp-config.json                 # MCP server registry
└── package.json                    # Root monorepo configuration
```

## Features

### Voice Agent
- **Speech-to-Text**: Audio file upload and transcription using OpenAI Whisper
- **Text Processing**: Direct text input processing  
- **Multi-LLM Support**: Claude 3.5 Sonnet and GPT-4 support
- **MCP Integration**: Tool calling via Model Context Protocol
- **RESTful API**: Express.js server with audio and text endpoints

### Finance MCP Server
- **MCP Tools**: SQL queries, schema inspection, financial analysis via MCP protocol
- **HTTP API Server**: Direct REST API access with read-only database security
- **Monarch Money Integration**: Live financial data import and sync
- **Database Queries**: Secure SQL query execution with write protection
- **Schema Inspection**: Database table and column information
- **House Affordability Analysis**: Comprehensive affordability calculations
- **Account Management**: Balance and transaction analysis

### Voice MCP Server  
- **Speech Command Processing**: Intent recognition from voice commands
- **Response Generation**: Speech-friendly text formatting
- **Context Awareness**: Command interpretation with context

## Quick Start

### Prerequisites
- Node.js 18+
- npm 9+
- OpenAI API key
- Anthropic API key (optional)
- Monarch Money token (optional, for data sync)

### Installation

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

# Optional - Claude support  
ANTHROPIC_API_KEY=your_anthropic_api_key_here
LLM_PROVIDER=claude  # or 'openai'

# Optional - Monarch Money sync
MONARCH_TOKEN=your_monarch_token_here

# Server configuration
PORT=3001
FINANCE_MCP_URL=http://localhost:3000
```

### Development

```bash
# Start voice agent in development mode
npm run dev

# Start finance MCP server (MCP protocol)
npm run dev:finance-mcp

# Start finance HTTP server (direct API access)
cd mcp-servers/finance-mcp && npm run start:http

# Start voice MCP server  
npm run dev:voice-mcp

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
npm run start:voice-mcp
```

## API Endpoints

### Voice Agent Server (Port 3001)

#### POST /api/audio
Upload audio file for voice processing.

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

### Finance HTTP Server (Port 3000)

Direct REST API access to financial data with read-only security.

#### POST /api/query
Execute read-only SQL queries on financial database.

**Request:**
```json
{
  "query": "SELECT COUNT(*) FROM transactions WHERE date >= '2024-01-01'",
  "params": []
}
```

**Response:**
```json
{
  "query": "SELECT COUNT(*) FROM transactions WHERE date >= '2024-01-01'",
  "row_count": 1,
  "results": [{"COUNT(*)": 1250}]
}
```

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

## Security Features

### Read-Only Database Access
The HTTP server uses `SQLITE_OPEN_READONLY` mode to prevent any write operations:
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
# Set your Monarch token and run sync
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

### Voice MCP Tools

#### process_speech_command
Process and categorize voice commands.
- Input: `{ text: string, context?: string }`
- Returns: Command type and parameters

#### generate_speech_response
Convert text to speech-friendly format.
- Input: `{ message: string, tone?: string }`
- Returns: Natural language response

## Database Schema

The SQLite database contains financial data with the following main tables:

- **accounts**: Bank accounts, balances, types, metadata
- **transactions**: Financial transactions with categories and descriptions
- **stock_options**: Stock option grants and valuations (if applicable)

### Sample Data Statistics
After Monarch import:
- **Accounts**: 64 accounts with current balances
- **Transactions**: 23,545+ historical transactions with categories
- **Data Integrity**: All transactions have unique IDs, no duplicates

## Testing

```bash
# Run all tests
npm test

# Run audio endpoint tests  
npm run test:audio --workspace=voice-agent

# Generate test audio files
npm run generate:audio --workspace=voice-agent

# Test HTTP API endpoints
curl http://localhost:3000/api/accounts
curl -X POST -H "Content-Type: application/json" \
  -d '{"query": "SELECT COUNT(*) FROM transactions"}' \
  http://localhost:3000/api/query
```

## Development Notes

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

The HTTP server implements multiple security layers:
- Read-only database connection prevents writes
- Query validation blocks dangerous SQL keywords
- Parameter binding prevents SQL injection
- Only SELECT statements are permitted

## Troubleshooting

### Common Issues

1. **Audio upload fails**: Check file format and size (max 25MB)
2. **Database errors**: Ensure `data/finance.db` exists and is readable  
3. **MCP connection issues**: Verify MCP servers are running on correct ports
4. **API key errors**: Check environment variables are set correctly
5. **Monarch sync fails**: Verify MONARCH_TOKEN is valid and has proper permissions

### Debugging

Enable debug logging:
```bash
DEBUG=* npm run dev
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License - see LICENSE file for details. 