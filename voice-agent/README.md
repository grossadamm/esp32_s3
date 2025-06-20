# Voice Agent - AI Finance Assistant

Voice-enabled finance assistant with adaptive speech recognition, GPU acceleration, and MCP integration. Processes both text and audio inputs for comprehensive financial analysis with optimized responses for spoken delivery.

## Features ✨

- **Adaptive Speech-to-Text**: GPU-aware audio processing with cloud fallback using AdaptiveSTTService
- **Verbal Response Optimization**: LLM responses optimized for spoken delivery vs text consumption
- **Unified Audio Processing**: Complete audio-to-audio pipeline with TTS generation
- **Text Processing**: Direct text queries with detailed formatting for financial AI assistant
- **MCP Integration**: Dynamic tool discovery from finance MCP server
- **Multi-LLM Support**: OpenAI GPT-4 and Anthropic Claude providers with context switching
- **GPU Acceleration**: NVIDIA hardware detection and optimization for 60-80% faster processing
- **Standardized Error Handling**: Consistent error responses with proper HTTP status codes
- **Financial Tools**: House affordability, retirement planning, expense analysis

## API Endpoints

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

The voice agent uses an MCP client approach with adaptive processing:

### Audio Processing Flow
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