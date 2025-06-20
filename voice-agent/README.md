# Voice Agent - AI Finance Assistant

Voice-enabled finance assistant with real-time streaming audio, adaptive speech recognition, GPU acceleration, and MCP integration. Supports both traditional file-based audio processing and real-time speech-to-speech conversations via OpenAI's Realtime API.

## Features ✨

- **Real-time Speech-to-Speech**: OpenAI Realtime API for instant voice conversations via WebSocket
- **MCP Realtime Bridge**: Seamless integration of MCP tools with OpenAI Realtime API for voice-driven execution
- **Adaptive Speech-to-Text**: GPU-aware audio processing with cloud fallback using AdaptiveSTTService
- **Verbal Response Optimization**: LLM responses optimized for spoken delivery vs text consumption
- **Unified Audio Processing**: Complete audio-to-audio pipeline with TTS generation
- **Live Audio Streaming**: WebSocket-based streaming with real-time transcription and response
- **Text Processing**: Direct text queries with detailed formatting for financial AI assistant
- **MCP Integration**: Dynamic tool discovery from MCP servers with real-time execution and argument parsing
- **Multi-LLM Support**: OpenAI GPT-4 and Anthropic Claude providers with context switching
- **GPU Acceleration**: NVIDIA hardware detection and optimization for 60-80% faster processing
- **Standardized Error Handling**: Consistent error responses with proper HTTP status codes
- **Financial Tools**: House affordability, retirement planning, expense analysis with live interaction

## MCP Realtime Bridge 🌉

The voice agent implements a sophisticated **MCP Realtime Bridge** (`MCPRealtimeBridge.ts`) that seamlessly integrates MCP tools with the OpenAI Realtime API for voice-driven tool execution.

### Bridge Architecture

**Core Components:**
- **Tool Discovery**: Automatically fetches available tools from all connected MCP servers
- **Format Conversion**: Converts MCP tool schemas to OpenAI Realtime API format
- **Argument Parsing**: Handles conversion between JSON strings (from OpenAI) and JavaScript objects (for MCP)
- **Execution Engine**: Routes tool calls to appropriate MCP servers and returns results
- **Error Handling**: Graceful fallback with detailed error reporting

### Bridge Features

**Automatic Tool Discovery:**
```typescript
// Bridge automatically discovers all available MCP tools
const realtimeTools = await bridge.convertMCPToolsToRealtimeFormat();
// Returns: 12 tools (7 finance + 5 dev tools) in OpenAI Realtime format
```

**Seamless Integration:**
- **Session Configuration**: Automatically configures OpenAI Realtime sessions with all MCP tools
- **Real-time Execution**: Tools are callable during live voice conversations
- **Argument Validation**: Proper JSON parsing and schema validation
- **Error Recovery**: Falls back gracefully when tools fail

**Current Tool Inventory:**
- **Finance Tools (7)**: Amazon transactions, house affordability, retirement planning, expense analysis, etc.
- **Dev Tools (5)**: Project management, HTTP servers, database queries, development utilities, etc.
- **Total**: 12 tools available for voice interaction

### Technical Implementation

**Tool Conversion Process:**
```typescript
// 1. Fetch MCP tools with their schemas
const mcpTools = await this.mcpClient.getAvailableTools();

// 2. Convert to OpenAI Realtime format
const realtimeTools = mcpTools.map(tool => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema  // MCP -> OpenAI format
}));
```

**Argument Parsing Fix:**
```typescript
// Handle OpenAI's JSON string arguments
if (typeof args === 'string') {
    parsedArgs = JSON.parse(args);  // Convert to JavaScript object
}
await this.mcpClient.executeTool(toolName, parsedArgs);
```

**Error Handling:**
- **Parsing Errors**: Invalid JSON arguments are caught and reported
- **Execution Errors**: Tool failures return structured error responses
- **Network Errors**: MCP server connection issues are handled gracefully
- **Fallback Behavior**: System continues operating even if some tools fail

### Bridge Usage in Realtime Audio

The bridge is automatically initialized when a WebSocket client connects:

```typescript
// Bridge is created and tools are discovered
const mcpBridge = new MCPRealtimeBridge(mcpClient);
const realtimeTools = await mcpBridge.convertMCPToolsToRealtimeFormat();

// OpenAI session is configured with all available tools
session.tools = realtimeTools;

// During conversation, tools are executed via the bridge
if (event.type === 'response.function_call_arguments.done') {
    const result = await mcpBridge.executeMCPTool(event.name, event.arguments);
}
```

### Performance & Reliability

**Optimizations:**
- **Tool Caching**: Tool definitions are cached for fast session setup
- **Async Execution**: Non-blocking tool execution during conversations
- **Connection Pooling**: Reuses MCP client connections efficiently
- **Error Isolation**: Failed tools don't impact other tool functionality

**Monitoring:**
- **Execution Timing**: Logs tool execution duration for performance monitoring
- **Success/Failure Tracking**: Detailed logging of tool call outcomes
- **Error Classification**: Structured error reporting for debugging

## API Endpoints

### Real-time Audio Streaming 🎙️ **NEW**
```
WebSocket: ws://localhost:3000/api/audio/realtime
```
Real-time speech-to-speech conversation via WebSocket with instant audio streaming.

**Features:**
- Live bidirectional audio streaming
- Real-time transcription display
- Voice activity detection
- MCP tool integration during conversation
- Support for interruptions and natural conversation flow

**Test Client:** Open `test-realtime-client.html` in browser for interactive testing.

### Health Check
```
GET /health
```

### Hardware Status ✨ **NEW**
```
GET /api/hardware-status
```
Returns GPU capabilities and hardware detection information.

### STT Status ✨ **NEW**
```
GET /api/stt-status
```
Returns speech-to-text service configuration and health status.

### Text Processing
```
POST /api/text
Content-Type: application/json

{
  "text": "How much house can I afford?"
}
```

**Response Format:**
```json
{
  "response": "Based on your financial data, you can afford a house up to $450,000...",
  "toolsUsed": ["house_affordability_analysis"]
}
```

### Audio Processing ✨ **ENHANCED**
```
POST /api/audio
Content-Type: multipart/form-data

Form data:
- audio: Audio file (WAV, MP3, MP4, M4A, WebM, OGG, max 25MB)
```

**Response:** MP3 audio file with spoken response
**Headers:**
- `X-Transcription`: URL-encoded transcription of input
- `X-Tools-Used`: Comma-separated list of tools used

**Features:**
- **Adaptive STT**: GPU processing when available, cloud fallback
- **Verbal Optimization**: Concise, conversational responses for speech
- **Hardware Agnostic**: Works with ESP32, web browsers, any audio device

## Response Optimization

The voice agent automatically optimizes responses based on endpoint:

### Audio Responses (`/api/audio`)
- **Concise & Conversational**: 1-3 sentences for simple queries
- **Natural Speech Patterns**: Avoids bullet points, uses spoken language
- **Selective Detail**: Longer explanations only when explicitly requested
- **Voice-Optimized**: Designed for text-to-speech delivery

### Text Responses (`/api/text`)
- **Comprehensive**: Full detailed analysis with formatting
- **Structured**: Bullet points, lists, technical precision
- **Complete Information**: Thorough explanations and context

## GPU Acceleration

### Adaptive Processing
- **Local GPU**: NVIDIA hardware accelerated processing (60-80% faster)
- **Cloud Fallback**: OpenAI Whisper for compatibility
- **Confidence Scoring**: Automatic routing based on transcription quality
- **Hardware Detection**: Optimizes for Jetson devices automatically

### Supported Hardware
- NVIDIA Jetson (Nano, Xavier, Orin)
- Desktop/Server GPUs (RTX, GTX, Tesla, A100)
- Automatic CPU fallback when GPU unavailable

## Error Handling

All endpoints return standardized error responses:

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
- `EXTERNAL_API_ERROR` (503): External service unavailable
- `SYSTEM_ERROR` (500): Internal system errors

## Supported Audio Formats

- WAV (audio/wav, audio/wave, audio/x-wav)
- MP3 (audio/mp3, audio/mpeg)
- MP4 (audio/mp4)
- M4A (audio/m4a, audio/x-m4a)
- WebM (audio/webm)
- OGG (audio/ogg)
- AIFF (audio/aiff, audio/x-aiff)

## Environment Variables

```env
PORT=3000
LLM_PROVIDER=openai    # or 'claude'
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## Setup

```bash
npm install
npm run build
npm start

# Development mode
npm run dev
```

## Architecture

The voice agent supports multiple processing modes with MCP integration:

### Real-time Audio Streaming Flow 🎙️ **NEW**
1. **WebSocket Connection**: Client establishes persistent connection
2. **MCP Bridge Initialization**: MCPRealtimeBridge discovers and converts all available MCP tools
3. **Session Configuration**: OpenAI Realtime session configured with all 12 MCP tools
4. **Live Audio Input**: Continuous audio chunks streamed to OpenAI Realtime API
5. **Real-time STT**: Instant transcription with live display
6. **Function Calling**: OpenAI identifies required tools during conversation
7. **Bridge Execution**: MCPRealtimeBridge parses arguments and executes MCP tools in real-time
8. **Tool Results**: Financial/dev tool results returned to OpenAI for response generation
9. **Streaming Response**: OpenAI generates and streams audio response with tool results
10. **Live Playback**: Audio chunks played as they arrive for natural conversation

### Traditional Audio Processing Flow
1. **Audio Input**: Multer handles file uploads with format validation
2. **Adaptive STT**: AdaptiveSTTService chooses GPU vs cloud processing
3. **Tool Discovery**: MCP client fetches available tools from finance server
4. **Verbal LLM Processing**: Provider processes with verbal response optimization
5. **Tool Execution**: MCP client executes financial analysis tools
6. **Text-to-Speech**: OpenAI TTS generates audio response
7. **Response**: Returns MP3 audio with metadata headers

### Text Processing Flow
1. **Text Input**: Direct text input with validation
2. **Tool Discovery**: MCP client fetches available tools
3. **Detailed LLM Processing**: Provider processes with full formatting
4. **Tool Execution**: MCP client executes financial analysis tools
5. **Response**: Returns detailed JSON with comprehensive analysis

## Example Usage

### Text Query (Detailed Response)
```bash
curl -X POST http://localhost:3000/api/text \
  -H "Content-Type: application/json" \
  -d '{"text": "What are my monthly expenses?"}'
```

### Audio Query (Voice Response)
```bash
curl -X POST http://localhost:3000/api/audio \
  -F "audio=@question.wav" \
  --output response.mp3
```

### Real-time Audio Testing 🎙️ **NEW**
```bash
# Open the interactive test client
open test-realtime-client.html
# Or navigate to: file:///path/to/voice-agent/test-realtime-client.html

# Interactive Testing Steps:
# 1. Click "Connect" to establish WebSocket connection
# 2. Click "Start Recording" and grant microphone access
# 3. Speak naturally: "What's my project status?" or "Show expenses"
# 4. Watch live transcription and hear immediate audio responses
# 5. Test tool integration with financial queries
```

### Check Hardware Capabilities
```bash
curl http://localhost:3000/api/hardware-status
curl http://localhost:3000/api/stt-status
```

## Architecture: MCP Client Approach

### Tool Flow
```
1. Voice Agent → Finance MCP Server: "What tools do you have?"
2. Finance MCP Server → Voice Agent: [tool definitions with schemas]
3. Voice Agent → LLM: "Here are available tools: [definitions]"
4. LLM → Voice Agent: "I want to call get_house_affordability"
5. Voice Agent → Finance MCP Server: [proxies the tool call]
6. Finance MCP Server → Finance Logic: [executes business logic]
7. Finance Logic → Voice Agent: [results via MCP]
8. Voice Agent → LLM: [tool results for reasoning]
```

### Separation of Concerns

**Voice Agent (This Service):**
- Audio I/O with adaptive processing
- LLM conversation with verbal optimization
- MCP client (discovery + proxy)
- Tool call orchestration
- Response format optimization

**Finance System:**
- Tool definitions and schemas
- Business logic implementation  
- Data access and calculations
- MCP server hosting

**Benefits:**
- Dynamic tool discovery
- Single source of truth for finance tools
- Protocol isolation
- Zero duplication
- Context-aware response optimization

## Performance Monitoring

Monitor processing performance:

```bash
# GPU utilization
nvidia-smi -l 1

# Service health
curl http://localhost:3000/health
curl http://localhost:3000/api/hardware-status

# STT configuration
curl http://localhost:3000/api/stt-status
```

## Development Notes

### Adding Response Optimization
- Use `isVerbalResponse` parameter in LLM providers
- Verbal responses: concise, conversational
- Text responses: detailed, formatted

### Error Handling Standards
- Import utilities from `utils/errorUtils.ts`
- Use structured logging from `utils/logger.ts`
- Consistent error classification and HTTP status codes

### GPU Optimization
- AdaptiveSTTService automatically detects hardware
- Confidence thresholds trigger cloud fallback
- Hardware detection enables optimal model selection 