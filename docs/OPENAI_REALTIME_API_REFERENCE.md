# OpenAI Realtime API Reference

## Overview

The **OpenAI Realtime API** is a low-latency, stateful, event-based WebSocket API that enables real-time voice and text conversations with GPT-4o. It provides native audio input/output capabilities, automatic conversation management, and robust function calling support.

### Key Features
- **Real-time audio streaming** (24kHz PCM or G.711)
- **Voice Activity Detection (VAD)** for natural turn-taking
- **Function calling/Tool usage** during conversations
- **Input audio transcription** via Whisper
- **Interruption handling** for natural conversations
- **Session management** with persistent context (up to 15 minutes)

### Technical Specifications
- **Model**: `gpt-4o-realtime-preview`
- **Audio format**: 16-bit PCM at 24kHz (384 kbps)
- **Context limit**: 128,000 tokens
- **Session limit**: 15 minutes maximum
- **Latency**: ~500ms time-to-first-byte (US locations)
- **Architecture**: 37 total events (9 client events, 28 server events)

## Function Calling / Tool Usage

### Tool Definition Format

The Realtime API uses a slightly different format than the HTTP API for tools:

**HTTP API Format:**
```javascript
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_current_weather",
            "description": "Get the current weather in a given location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g. San Francisco, CA"
                    }
                },
                "required": ["location"]
            }
        }
    }
]
```

**Realtime API Format:**
```javascript
tools = [
    {
        "type": "function",
        "name": "get_current_weather", 
        "description": "Get the current weather",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "The city and state, e.g. San Francisco, CA"
                },
                "format": {
                    "type": "string",
                    "enum": ["celsius", "fahrenheit"],
                    "description": "The temperature unit to use. Infer this from the users location."
                }
            },
            "required": ["location", "format"]
        }
    }
]
```

### MCP Integration with Realtime API

```typescript
// Convert MCP tool definitions to Realtime API format
function convertMCPToolsToRealtimeFormat(mcpTools: MCPTool[]): RealtimeTool[] {
    return mcpTools.map(tool => ({
        type: "function",
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
    }));
}

// Handle MCP function calls in Realtime API
async function handleMCPFunctionCall(
    functionName: string, 
    args: any, 
    mcpClient: MCPClient
): Promise<string> {
    const result = await mcpClient.callTool(functionName, args);
    return JSON.stringify(result);
}
```

### Function Call Event Handling

```javascript
// Listen for function call events
openAiWs.on('message', (data) => {
    const response = JSON.parse(data);
    
    // Handle function call completion
    if (response.type === 'response.function_call_arguments.done') {
        const functionName = response.name;
        const functionArgs = JSON.parse(response.arguments);
        
        // Execute the function via MCP
        const result = await mcpClient.callTool(functionName, functionArgs);
        
        // Send result back to the API
        const functionResult = {
            type: 'conversation.item.create',
            item: {
                type: 'function_call_output',
                call_id: response.call_id,
                output: JSON.stringify(result)
            }
        };
        
        openAiWs.send(JSON.stringify(functionResult));
        openAiWs.send(JSON.stringify({ type: 'response.create' }));
    }
});
```

## Session Management

### Session Configuration with MCP Tools

```javascript
const sessionUpdate = {
    type: 'session.update',
    session: {
        turn_detection: { type: 'server_vad' },
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        voice: 'alloy',
        instructions: 'You are a helpful financial and development assistant with access to finance tools and development utilities.',
        modalities: ["text", "audio"],
        temperature: 0.8,
        tools: await convertMCPToolsToRealtimeFormat(await mcpClient.listTools())
    }
};
```

## Best Practices for MCP Voice Agent

### 1. Tool Performance
- Keep MCP tool calls fast (<2 seconds) for real-time experience
- Implement timeouts for MCP operations
- Cache frequently accessed data

### 2. Error Handling
```typescript
try {
    const result = await mcpClient.callTool(functionName, args);
    return JSON.stringify(result);
} catch (error) {
    logger.error('MCP tool call failed:', error);
    return JSON.stringify({ 
        error: 'Tool execution failed',
        message: error.message 
    });
}
```

### 3. Cost Management
- Monitor session length (15min limit)
- Implement conversation summarization for long sessions
- Use server VAD to reduce unnecessary audio processing

### 4. Voice Activity Detection
```javascript
{
    "turn_detection": {
        "type": "server_vad",
        "threshold": 0.5,
        "prefix_padding_ms": 300,
        "silence_duration_ms": 500  // Adjust based on use case
    }
}
```

## Production Architecture

### Recommended Setup
```
[Client Browser] ↔ [WebRTC] ↔ [Voice Agent Server] ↔ [OpenAI Realtime API]
                                       ↕
                               [MCP Servers (Finance, Dev Tools)]
```

### Key Components
1. **WebRTC Proxy**: Handle client audio with low latency
2. **Realtime API Bridge**: Convert between WebRTC and Realtime API
3. **MCP Tool Registry**: Dynamic tool discovery and execution
4. **Session Manager**: Handle 15-minute limits and reconnection

## Limitations & Considerations

- **15-minute session limit** - Implement session handoff
- **128k token context** - Use conversation summarization
- **WebSocket TCP limitations** - Use WebRTC for client audio
- **Function call latency** - Optimize MCP tool performance
- **Cost scaling** - Monitor token usage carefully

## Integration Plan

Based on your current setup, here's how to enhance your voice agent:

### 1. Enhanced OpenAI Service
```typescript
export class OpenAIRealtimeService {
    private ws: WebSocket;
    private mcpClient: MCPClient;
    
    async initializeSession(tools: MCPTool[]) {
        const realtimeTools = convertMCPToolsToRealtimeFormat(tools);
        
        const sessionConfig = {
            type: 'session.update',
            session: {
                instructions: this.getSystemPrompt(),
                tools: realtimeTools,
                turn_detection: { type: 'server_vad' },
                // ... other config
            }
        };
        
        this.ws.send(JSON.stringify(sessionConfig));
    }
    
    private async handleFunctionCall(event: any) {
        const result = await this.mcpClient.callTool(
            event.name, 
            JSON.parse(event.arguments)
        );
        
        // Send result back to Realtime API
        this.sendFunctionResult(event.call_id, result);
    }
}
```

### 2. MCP Tool Bridge
```typescript
export class MCPRealtimeBridge {
    constructor(
        private realtimeService: OpenAIRealtimeService,
        private mcpClient: MCPClient
    ) {}
    
    async initialize() {
        const tools = await this.mcpClient.listTools();
        await this.realtimeService.initializeSession(tools);
        
        // Set up event handlers
        this.realtimeService.on('function_call', this.handleFunctionCall.bind(this));
    }
    
    private async handleFunctionCall(event: FunctionCallEvent) {
        const result = await this.mcpClient.callTool(event.name, event.args);
        return this.realtimeService.sendFunctionResult(event.call_id, result);
    }
}
``` 