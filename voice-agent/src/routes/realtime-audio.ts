import { WebSocketServer, WebSocket } from 'ws';
import { OpenAI } from 'openai';
import { MCPService } from '../services/MCPService.js';
import { MCPRealtimeBridge } from '../services/MCPRealtimeBridge.js';
import { logError, logInfo, logWarning } from '../utils/logger.js';

export class RealtimeAudioService {
  private wss!: WebSocketServer;
  private openai: OpenAI;
  private mcpBridge!: MCPRealtimeBridge;
  private mcpService: MCPService;

  constructor(mcpService: MCPService) {
    this.mcpService = mcpService;
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async initialize(server: any) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/api/audio/realtime'
    });

    // Initialize MCP bridge
    const mcpClient = this.mcpService.getClient();
    this.mcpBridge = new MCPRealtimeBridge(mcpClient);

    this.wss.on('connection', async (ws: WebSocket) => {
      logInfo('Realtime Audio', 'Client connected');
      
      try {
        await this.handleRealtimeConnection(ws);
      } catch (error) {
        logError('Realtime Audio', 'Connection failed', error);
        ws.close();
      }
    });

    logInfo('Realtime Audio', 'WebSocket server initialized on /api/audio/realtime');
  }

  private async handleRealtimeConnection(clientWs: WebSocket) {
    // Connect to OpenAI Realtime API
    const realtimeWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    // Track function call state
    let pendingFunctionCalls = new Map();

    // OpenAI connection opened
    realtimeWs.on('open', async () => {
      logInfo('Realtime Audio', 'Connected to OpenAI Realtime API');
      
      try {
        // Get tools via bridge
        const realtimeTools = await this.mcpBridge.convertMCPToolsToRealtimeFormat();
        
        // Configure session with MCP tools
        const sessionConfig = {
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            voice: 'alloy',
            instructions: `You are a helpful voice assistant with access to local tools via MCP (Model Context Protocol). 
                          You can access project information, financial data, and other local resources. 
                          Be conversational and helpful. Keep responses concise for voice interaction.
                          Use available tools when appropriate to answer user questions.`,
            tools: realtimeTools,
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 600  // Slightly longer for thoughtful responses
            }
          }
        };
        
        realtimeWs.send(JSON.stringify(sessionConfig));
        logInfo('Realtime Audio', `Session configured with ${realtimeTools.length} MCP tools`);
        
      } catch (error) {
        logError('Realtime Audio', 'Failed to configure session with MCP tools', error);
        // Continue without tools if bridge fails
        const fallbackConfig = {
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            voice: 'alloy',
            instructions: 'You are a helpful voice assistant.',
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 600
            }
          }
        };
        realtimeWs.send(JSON.stringify(fallbackConfig));
      }
    });

    // Handle OpenAI messages
    realtimeWs.on('message', async (data: Buffer) => {
      try {
        const event = JSON.parse(data.toString());
        
        // Log important events for debugging
        if (['session.created', 'response.function_call_arguments.done', 'error'].includes(event.type)) {
          console.log('OpenAI Realtime Event:', JSON.stringify(event, null, 2));
        }
        
        switch (event.type) {
          case 'session.created':
            logInfo('Realtime Audio', 'Session created');
            clientWs.send(JSON.stringify({ type: 'session_ready' }));
            break;

          case 'response.audio.delta':
            // Stream audio back to client
            clientWs.send(JSON.stringify({
              type: 'audio_delta',
              audio: event.delta
            }));
            break;

          case 'response.audio_transcript.delta':
            // Stream transcript for UI
            clientWs.send(JSON.stringify({
              type: 'transcript_delta', 
              text: event.delta
            }));
            break;

          case 'response.function_call_arguments.done':
            // Execute MCP tool via bridge
            await this.handleFunctionCall(event, realtimeWs);
            break;

          case 'input_audio_buffer.speech_started':
            clientWs.send(JSON.stringify({ type: 'speech_started' }));
            break;

          case 'input_audio_buffer.speech_stopped':
            clientWs.send(JSON.stringify({ type: 'speech_stopped' }));
            break;

          case 'error':
            logError('OpenAI Realtime', 'API error', event.error);
            clientWs.send(JSON.stringify({ type: 'error', error: event.error }));
            break;
            
          default:
            // Only log unhandled events in debug mode
            if (process.env.DEBUG_REALTIME_EVENTS === 'true') {
              console.log('Unhandled OpenAI event type:', event.type);
            }
        }
      } catch (error) {
        logError('Realtime Audio', 'Message processing error', error);
      }
    });

    // Handle client messages (audio from user)
    clientWs.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'audio_chunk') {
          // Forward audio to OpenAI
          realtimeWs.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: message.audio
          }));
        }
      } catch (error: any) {
        // Assume raw audio data if not JSON
        const audioBase64 = data.toString('base64');
        realtimeWs.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: audioBase64
        }));
      }
    });

    // Cleanup on disconnect
    clientWs.on('close', () => {
      logInfo('Realtime Audio', 'Client disconnected');
      realtimeWs.close();
    });

    realtimeWs.on('close', () => {
      logInfo('Realtime Audio', 'OpenAI connection closed');
    });

    realtimeWs.on('error', (error) => {
      logError('OpenAI Realtime', 'Connection error', error);
      clientWs.close();
    });
  }

  private async handleFunctionCall(event: any, realtimeWs: WebSocket) {
    try {
      const { name, arguments: args, call_id } = event;
      
      // Check if bridge has this tool
      if (!this.mcpBridge.hasTool(name)) {
        logWarning('Realtime Audio', `Unknown tool requested: ${name}`);
        this.sendFunctionError(realtimeWs, call_id, `Tool ${name} not available`);
        return;
      }
      
      // Execute via MCP bridge
      const result = await this.mcpBridge.executeMCPTool(name, args);
      
      // Send result back to OpenAI
      this.sendFunctionResult(realtimeWs, call_id, result);

      // Trigger response with function result
      realtimeWs.send(JSON.stringify({
        type: 'response.create'
      }));

    } catch (error) {
      logError('MCP Function', `Failed to execute ${event.name}`, error);
      this.sendFunctionError(realtimeWs, event.call_id, 'Function execution failed');
    }
  }

  private sendFunctionResult(realtimeWs: WebSocket, callId: string, result: string) {
    realtimeWs.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: result
      }
    }));
  }

  private sendFunctionError(realtimeWs: WebSocket, callId: string, errorMessage: string) {
    realtimeWs.send(JSON.stringify({
      type: 'conversation.item.create', 
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify({ error: errorMessage })
      }
    }));
  }

  async close() {
    // The singleton MCP client will be closed by the main process
    this.wss.close();
  }
} 