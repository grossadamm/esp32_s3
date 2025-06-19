# STT Agent - Voice Finance Assistant

Voice-enabled finance assistant with Claude/OpenAI and MCP integration. Processes both text and audio inputs for comprehensive financial analysis.

## Features

- **Text Processing**: Direct text queries to financial AI assistant
- **Audio Processing**: Speech-to-text via OpenAI Whisper with AI analysis
- **MCP Integration**: Dynamic tool discovery from finance MCP server
- **Multi-LLM Support**: OpenAI GPT-4 and Anthropic Claude providers
- **Financial Tools**: House affordability, retirement planning, expense analysis

## API Endpoints

### Health Check
```
GET /health
```

### Text Processing
```
POST /api/text
Content-Type: application/json

{
  "text": "How much house can I afford?"
}
```

### Audio Processing
```
POST /api/audio
Content-Type: multipart/form-data

Form data:
- audio: Audio file (WAV, MP3, MP4, M4A, WebM, OGG, max 25MB)
```

**Audio Response:**
```json
{
  "transcription": "How much house can I afford?",
  "response": "Based on your financial data...",
  "toolsUsed": ["house_affordability_analysis"]
}
```

## Supported Audio Formats

- WAV (audio/wav)
- MP3 (audio/mp3, audio/mpeg)
- MP4 (audio/mp4)
- M4A (audio/m4a)
- WebM (audio/webm)
- OGG (audio/ogg)

## Environment Variables

```env
PORT=3001
LLM_PROVIDER=openai    # or 'claude'
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
FINANCE_MCP_URL=http://localhost:3000
```

## Setup

```bash
npm install
npm run dev
```

## Architecture

The STT agent uses an MCP client approach to dynamically discover and execute tools from the finance system:

1. **Audio Input**: Multer handles file uploads
2. **Speech-to-Text**: OpenAI Whisper transcribes audio
3. **Tool Discovery**: MCP client fetches available tools from finance server
4. **LLM Processing**: Provider processes transcribed text with tool calling
5. **Tool Execution**: MCP client executes financial analysis tools
6. **Response**: Returns transcription, analysis, and tools used

## Example Usage

### Text Query
```bash
curl -X POST http://localhost:3001/api/text \
  -H "Content-Type: application/json" \
  -d '{"text": "What are my monthly expenses?"}'
```

### Audio Query
```bash
curl -X POST http://localhost:3001/api/audio \
  -F "audio=@question.wav"
```

## Overview
TypeScript-based agent that processes text/speech queries using Claude with tool calling capabilities via MCP (Model Context Protocol) client integration.

## Architecture: MCP Client Approach

### Tool Flow
```
1. STT Agent → Finance MCP Server: "What tools do you have?"
2. Finance MCP Server → STT Agent: [tool definitions with schemas]
3. STT Agent → Claude: "Here are available tools: [definitions]"
4. Claude → STT Agent: "I want to call get_house_affordability"
5. STT Agent → Finance MCP Server: [proxies the tool call]
6. Finance MCP Server → Finance Logic: [executes business logic]
7. Finance Logic → STT Agent: [results via MCP]
8. STT Agent → Claude: [tool results for reasoning]
```

### Separation of Concerns

**STT Agent (This Repo):**
- Voice I/O and Claude conversation
- MCP client (discovery + proxy)
- Tool call orchestration
- User interaction flow

**Finance System (../finance):**
- Tool definitions and schemas
- Business logic implementation  
- Data access and calculations
- MCP server hosting

**Benefits:**
- Dynamic tool discovery
- Single source of truth for finance tools
- Protocol isolation
- Zero duplication
- LLM gets full tool awareness

## Setup

```bash
# Install dependencies
npm install

# Create .env file
echo "ANTHROPIC_API_KEY=your_key_here" > .env
echo "FINANCE_MCP_URL=http://localhost:8000" >> .env  
echo "PORT=3001" >> .env

# Start development server
npm run dev
```

## Environment Variables
Create a `.env` file with:
```bash
ANTHROPIC_API_KEY=your_anthropic_api_key
FINANCE_MCP_URL=http://localhost:8000
PORT=3001
```

## MVP Scope
- Text endpoint only
- Claude integration with tool calling
- MCP client for finance tools
- Basic Express server
- No authentication, logging, or audio yet 