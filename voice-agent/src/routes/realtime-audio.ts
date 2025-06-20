import { WebSocketServer, WebSocket } from 'ws';
import { OpenAI } from 'openai';
import { MCPClient } from '../services/MCPClient.js';
import { logError, logInfo, logWarning } from '../utils/logger.js';

export class RealtimeAudioService {
  private wss!: WebSocketServer;
  private mcpClient: MCPClient;
  private openai: OpenAI;

  constructor() {
    this.mcpClient = new MCPClient();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async initialize(server: any) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/api/audio/realtime'
    });

    this.wss.on('connection', async (ws: WebSocket) => {
      logInfo('Realtime Audio', 'Client connected');
      
      try {
        // Get available MCP tools
        const tools = await this.mcpClient.getAvailableTools();
        await this.handleRealtimeConnection(ws, tools);
      } catch (error) {
        logError('Realtime Audio', 'Connection failed', error);
        ws.close();
      }
    });

    logInfo('Realtime Audio', 'WebSocket server initialized on /api/audio/realtime');
  }

  private async handleRealtimeConnection(clientWs: WebSocket, mcpTools: any[]) {
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
    realtimeWs.on('open', () => {
      logInfo('Realtime Audio', 'Connected to OpenAI Realtime API');
      
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
          tools: mcpTools.map(tool => ({
            type: 'function',
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema
          })),
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 200
          }
        }
      };
      
      realtimeWs.send(JSON.stringify(sessionConfig));
    });

    // Handle OpenAI messages
    realtimeWs.on('message', async (data: Buffer) => {
      try {
        const event = JSON.parse(data.toString());
        
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
            // Execute MCP tool
            await this.executeMCPFunction(event, realtimeWs);
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

  private async executeMCPFunction(event: any, realtimeWs: WebSocket) {
    try {
      const { name, arguments: args, call_id } = event;
      
      logInfo('Realtime Audio', `Executing MCP tool: ${name}`, args);
      
      // Execute via existing MCP client
      const result = await this.mcpClient.executeTool(name, args);
      
      // Send result back to OpenAI
      realtimeWs.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id,
          output: JSON.stringify(result)
        }
      }));

      // Trigger response with function result
      realtimeWs.send(JSON.stringify({
        type: 'response.create'
      }));

    } catch (error) {
      logError('MCP Function', `Failed to execute ${event.name}`, error);
      
      // Send error back to OpenAI
      realtimeWs.send(JSON.stringify({
        type: 'conversation.item.create', 
        item: {
          type: 'function_call_output',
          call_id: event.call_id,
          output: JSON.stringify({ error: 'Function execution failed' })
        }
      }));
    }
  }

  async close() {
    await this.mcpClient.close();
    this.wss.close();
  }
} 