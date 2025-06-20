# Realtime API Integration Plan

## Current State Analysis

Based on the logs, our voice agent currently has:
- ✅ OpenAI Realtime API connection established
- ✅ MCP servers running (finance-mcp, dev-tools-mcp)
- ✅ Adaptive STT service
- ✅ Docker containerized architecture
- ✅ Basic voice interaction capabilities

## Enhancement Roadmap

### Phase 1: MCP-Realtime API Bridge (High Priority)

#### 1.1 Create MCP Tool Converter
**File**: `voice-agent/src/services/MCPRealtimeBridge.ts`

```typescript
export class MCPRealtimeBridge {
    private mcpClient: MCPClient;
    private logger: Logger;
    
    constructor(mcpClient: MCPClient) {
        this.mcpClient = mcpClient;
        this.logger = getLogger('MCPRealtimeBridge');
    }
    
    async convertMCPToolsToRealtimeFormat(): Promise<RealtimeTool[]> {
        try {
            const mcpTools = await this.mcpClient.listTools();
            return mcpTools.map(tool => ({
                type: "function",
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema
            }));
        } catch (error) {
            this.logger.error('Failed to convert MCP tools:', error);
            return [];
        }
    }
    
    async executeMCPTool(toolName: string, args: any): Promise<string> {
        try {
            const startTime = Date.now();
            const result = await this.mcpClient.callTool(toolName, args);
            const duration = Date.now() - startTime;
            
            this.logger.info(`MCP tool ${toolName} executed in ${duration}ms`);
            return JSON.stringify(result);
        } catch (error) {
            this.logger.error(`MCP tool ${toolName} failed:`, error);
            return JSON.stringify({
                error: 'Tool execution failed',
                message: error.message,
                toolName
            });
        }
    }
}
```

#### 1.2 Enhance OpenAI Service for Function Calls
**File**: `voice-agent/src/services/OpenAIRealtimeService.ts`

```typescript
export class OpenAIRealtimeService extends ClaudeService {
    private mcpBridge: MCPRealtimeBridge;
    private sessionConfig: RealtimeSessionConfig;
    
    constructor(mcpClient: MCPClient) {
        super();
        this.mcpBridge = new MCPRealtimeBridge(mcpClient);
    }
    
    async initializeRealtimeSession(): Promise<void> {
        const tools = await this.mcpBridge.convertMCPToolsToRealtimeFormat();
        
        this.sessionConfig = {
            type: 'session.update',
            session: {
                instructions: this.buildSystemPrompt(),
                voice: 'alloy',
                turn_detection: { 
                    type: 'server_vad',
                    silence_duration_ms: 600  // Slightly longer for thoughtful responses
                },
                input_audio_format: 'pcm16',
                output_audio_format: 'pcm16',
                input_audio_transcription: { model: 'whisper-1' },
                modalities: ['text', 'audio'],
                temperature: 0.7,
                tools: tools
            }
        };
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(this.sessionConfig));
            this.logger.info(`Initialized Realtime session with ${tools.length} MCP tools`);
        }
    }
    
    private buildSystemPrompt(): string {
        return `You are a helpful financial and development assistant with access to:
        
        Finance Tools:
        - Portfolio analysis and tracking
        - Transaction categorization and analysis
        - Investment recommendations
        - Budget planning and expense tracking
        
        Development Tools:
        - Code analysis and debugging
        - Project management utilities
        - Development environment setup
        - Technical documentation assistance
        
        Always be concise in your responses while being helpful. When using tools, explain what you're doing and what the results mean in practical terms.`;
    }
    
    protected async handleFunctionCall(event: any): Promise<void> {
        if (event.type === 'response.function_call_arguments.done') {
            const { name: functionName, arguments: functionArgs, call_id } = event;
            
            this.logger.info(`Executing function call: ${functionName}`);
            
            try {
                const result = await this.mcpBridge.executeMCPTool(
                    functionName, 
                    JSON.parse(functionArgs)
                );
                
                // Send result back to Realtime API
                this.sendFunctionResult(call_id, result);
                
                // Trigger response generation
                this.ws.send(JSON.stringify({ type: 'response.create' }));
                
            } catch (error) {
                this.logger.error('Function call execution failed:', error);
                this.sendFunctionResult(call_id, JSON.stringify({
                    error: 'Function execution failed',
                    message: error.message
                }));
            }
        }
    }
    
    private sendFunctionResult(callId: string, result: string): void {
        const functionResult = {
            type: 'conversation.item.create',
            item: {
                type: 'function_call_output',
                call_id: callId,
                output: result
            }
        };
        
        this.ws.send(JSON.stringify(functionResult));
    }
}
```

### Phase 2: Session Management & Reliability (Medium Priority)

#### 2.1 Session Manager
**File**: `voice-agent/src/services/RealtimeSessionManager.ts`

```typescript
export class RealtimeSessionManager {
    private sessions: Map<string, RealtimeSession> = new Map();
    private readonly SESSION_TIMEOUT = 14 * 60 * 1000; // 14 minutes (1min buffer)
    
    async createSession(userId: string): Promise<RealtimeSession> {
        const session = new RealtimeSession(userId);
        
        // Set up session timeout
        setTimeout(() => {
            this.handleSessionTimeout(userId);
        }, this.SESSION_TIMEOUT);
        
        this.sessions.set(userId, session);
        return session;
    }
    
    private async handleSessionTimeout(userId: string): Promise<void> {
        const session = this.sessions.get(userId);
        if (session) {
            // Save conversation summary
            await this.saveConversationSummary(session);
            
            // Create new session with context
            const newSession = await this.createSession(userId);
            await this.transferContext(session, newSession);
            
            this.logger.info(`Session renewed for user ${userId}`);
        }
    }
    
    private async saveConversationSummary(session: RealtimeSession): Promise<void> {
        // Implement conversation summarization logic
        const summary = await this.summarizeConversation(session.getTranscript());
        await this.persistConversationData(session.userId, summary);
    }
}
```

#### 2.2 Enhanced Error Handling
**File**: `voice-agent/src/utils/RealtimeErrorHandler.ts`

```typescript
export class RealtimeErrorHandler {
    private reconnectAttempts = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 3;
    
    async handleRealtimeError(error: any, service: OpenAIRealtimeService): Promise<void> {
        this.logger.error('Realtime API error:', error);
        
        switch (error.type) {
            case 'connection_error':
                await this.handleConnectionError(service);
                break;
            case 'function_call_error':
                await this.handleFunctionCallError(error);
                break;
            case 'audio_processing_error':
                await this.handleAudioError(error);
                break;
            default:
                this.logger.warn('Unknown error type:', error.type);
        }
    }
    
    private async handleConnectionError(service: OpenAIRealtimeService): Promise<void> {
        if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
            this.reconnectAttempts++;
            const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
            
            this.logger.info(`Attempting reconnection ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
            
            setTimeout(async () => {
                await service.reconnect();
            }, delay);
        } else {
            this.logger.error('Max reconnection attempts reached. Falling back to text mode.');
            // Implement fallback to text-only mode
        }
    }
}
```

### Phase 3: Production Optimizations (Lower Priority)

#### 3.1 WebRTC Proxy for Client Audio
**File**: `voice-agent/src/services/WebRTCProxyService.ts`

```typescript
export class WebRTCProxyService {
    private peerConnections: Map<string, RTCPeerConnection> = new Map();
    
    async setupWebRTCProxy(userId: string): Promise<RTCSessionDescription> {
        const peerConnection = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        
        // Set up audio processing
        peerConnection.ontrack = (event) => {
            this.handleIncomingAudio(userId, event.streams[0]);
        };
        
        this.peerConnections.set(userId, peerConnection);
        
        // Create offer for client
        const offer = await peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: false
        });
        
        await peerConnection.setLocalDescription(offer);
        return offer;
    }
    
    private async handleIncomingAudio(userId: string, stream: MediaStream): Promise<void> {
        // Convert WebRTC audio to PCM16 for Realtime API
        const audioProcessor = new AudioProcessor();
        const pcmData = await audioProcessor.convertToPCM16(stream);
        
        // Send to Realtime API
        const realtimeService = this.getRealtimeService(userId);
        realtimeService.sendAudioData(pcmData);
    }
}
```

#### 3.2 Performance Monitoring
**File**: `voice-agent/src/services/RealtimeMetricsService.ts`

```typescript
export class RealtimeMetricsService {
    private metrics: RealtimeMetrics = new RealtimeMetrics();
    
    trackLatency(eventType: string, startTime: number): void {
        const latency = Date.now() - startTime;
        this.metrics.recordLatency(eventType, latency);
        
        if (latency > 1000) {
            this.logger.warn(`High latency detected for ${eventType}: ${latency}ms`);
        }
    }
    
    trackTokenUsage(inputTokens: number, outputTokens: number): void {
        this.metrics.recordTokenUsage(inputTokens, outputTokens);
        
        const totalCost = this.calculateCost(inputTokens, outputTokens);
        if (totalCost > 0.50) { // Alert on high cost per interaction
            this.logger.warn(`High cost interaction: $${totalCost.toFixed(3)}`);
        }
    }
    
    trackMCPToolPerformance(toolName: string, duration: number, success: boolean): void {
        this.metrics.recordToolCall(toolName, duration, success);
        
        if (duration > 2000) {
            this.logger.warn(`Slow MCP tool call: ${toolName} took ${duration}ms`);
        }
    }
}
```

### Phase 4: Configuration & Documentation

#### 4.1 Enhanced Configuration
**File**: `voice-agent/src/config/realtimeConfig.ts`

```typescript
export interface RealtimeConfig {
    voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
    vadConfig: {
        type: 'server_vad' | 'none';
        threshold?: number;
        silenceDurationMs: number;
        prefixPaddingMs: number;
    };
    sessionConfig: {
        maxTokens: number;
        temperature: number;
        timeoutMinutes: number;
    };
    mcpConfig: {
        toolTimeoutMs: number;
        maxConcurrentCalls: number;
        enableCaching: boolean;
    };
}

export const defaultRealtimeConfig: RealtimeConfig = {
    voice: 'alloy',
    vadConfig: {
        type: 'server_vad',
        threshold: 0.5,
        silenceDurationMs: 600,
        prefixPaddingMs: 300
    },
    sessionConfig: {
        maxTokens: 4096,
        temperature: 0.7,
        timeoutMinutes: 14
    },
    mcpConfig: {
        toolTimeoutMs: 5000,
        maxConcurrentCalls: 3,
        enableCaching: true
    }
};
```

#### 4.2 Update Docker Configuration
**File**: `docker-compose.yml` (enhancement)

```yaml
version: '3.8'

services:
  mcp-voice-agent:
    # ... existing config ...
    environment:
      # ... existing env vars ...
      - REALTIME_VOICE=alloy
      - REALTIME_VAD_SILENCE_MS=600
      - REALTIME_SESSION_TIMEOUT_MIN=14
      - MCP_TOOL_TIMEOUT_MS=5000
      - ENABLE_WEBRTC_PROXY=false  # Set to true for production
      - METRICS_ENABLED=true
    
    # Add health checks for Realtime API
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health/realtime"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Implementation Timeline

#### Week 1: Core MCP-Realtime Integration
- [ ] Create `MCPRealtimeBridge` class
- [ ] Enhance `OpenAIRealtimeService` with function calling
- [ ] Update session initialization with MCP tools
- [ ] Test function calling with existing finance and dev tools

#### Week 2: Session Management & Reliability  
- [ ] Implement `RealtimeSessionManager`
- [ ] Add comprehensive error handling
- [ ] Create session timeout and renewal logic
- [ ] Add conversation summarization

#### Week 3: Performance & Monitoring
- [ ] Implement `RealtimeMetricsService`
- [ ] Add latency and cost tracking
- [ ] Optimize MCP tool performance
- [ ] Add health checks and monitoring dashboards

#### Week 4: Production Preparation
- [ ] WebRTC proxy implementation (optional)
- [ ] Load testing and performance tuning
- [ ] Security review and hardening
- [ ] Documentation and deployment guides

### Testing Strategy

#### Unit Tests
```typescript
// voice-agent/tests/services/MCPRealtimeBridge.test.ts
describe('MCPRealtimeBridge', () => {
    test('converts MCP tools to Realtime format', async () => {
        const bridge = new MCPRealtimeBridge(mockMCPClient);
        const tools = await bridge.convertMCPToolsToRealtimeFormat();
        
        expect(tools).toHaveLength(mockMCPClient.tools.length);
        expect(tools[0]).toHaveProperty('type', 'function');
        expect(tools[0]).not.toHaveProperty('function'); // Should be flattened
    });
});
```

#### Integration Tests
```typescript
// voice-agent/tests/integration/realtime-mcp.test.ts
describe('Realtime-MCP Integration', () => {
    test('executes MCP tool via Realtime API', async () => {
        const service = new OpenAIRealtimeService(mcpClient);
        await service.initializeRealtimeSession();
        
        // Simulate function call from Realtime API
        const functionCall = {
            type: 'response.function_call_arguments.done',
            name: 'get_portfolio_summary',
            arguments: '{}',
            call_id: 'test-call-id'
        };
        
        await service.handleFunctionCall(functionCall);
        
        expect(mcpClient.callTool).toHaveBeenCalledWith('get_portfolio_summary', {});
    });
});
```

### Monitoring & Alerting

#### Key Metrics to Track
1. **Latency Metrics**
   - Voice-to-voice response time
   - MCP tool execution time
   - Session initialization time

2. **Cost Metrics**
   - Token usage per session
   - Cost per minute of conversation
   - Function call frequency

3. **Reliability Metrics**
   - Session success rate
   - Function call error rate
   - WebSocket reconnection frequency

4. **Performance Metrics**
   - Concurrent session count
   - Memory usage trends
   - CPU utilization during audio processing

### Rollout Strategy

#### Phase 1: Internal Testing (2 weeks)
- Deploy to development environment
- Test with finance and dev tools
- Validate function calling accuracy
- Performance baseline establishment

#### Phase 2: Limited Beta (2 weeks)
- Deploy to staging with real user data
- Monitor cost and performance
- Gather user feedback on voice interaction quality
- Iterate on VAD settings and tool responses

#### Phase 3: Production Rollout (1 week)
- Gradual rollout with feature flags
- Monitor all metrics closely
- Have rollback plan ready
- Document operational procedures

This plan transforms your existing voice agent into a production-ready system that fully leverages the OpenAI Realtime API's capabilities while maintaining integration with your MCP servers. 