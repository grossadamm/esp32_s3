# MCP Voice Agent Monorepo

A voice-controlled AI agent with MCP (Model Context Protocol) tool integration for financial analysis and management.

## Architecture

```
mcp-voice-agent/
├── voice-agent/                    # Main voice agent application
│   ├── src/
│   │   ├── services/
│   │   │   ├── finance/            # Finance-specific services
│   │   │   │   └── MonarchSync.ts  # Monarch Money API integration
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
│   │   ├── src/index.ts
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
- **Database Queries**: SQL query execution on financial database
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

# Start finance MCP server
npm run dev:finance-mcp

# Start voice MCP server  
npm run dev:voice-mcp

# Sync financial data from Monarch Money
npm run sync:monarch
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

- **accounts**: Bank accounts, balances, types
- **transactions**: Financial transactions with categories
- **stock_options**: Stock option grants and valuations (if applicable)

## Testing

```bash
# Run all tests
npm test

# Run audio endpoint tests  
npm run test:audio --workspace=voice-agent

# Generate test audio files
npm run generate:audio --workspace=voice-agent
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

### Financial Data Sync

The Monarch Money sync service (`MonarchSync.ts`) can import financial data:

```bash
# Sync accounts and transactions  
npm run sync:monarch
```

## Troubleshooting

### Common Issues

1. **Audio upload fails**: Check file format and size (max 25MB)
2. **Database errors**: Ensure `data/finance.db` exists and is readable  
3. **MCP connection issues**: Verify MCP servers are running on correct ports
4. **API key errors**: Check environment variables are set correctly

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