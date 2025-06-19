import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { OpenAI } from 'openai';

const server = new Server(
  {
    name: 'voice-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize OpenAI client for audio processing
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'process_speech_command',
        description: 'Process and interpret speech commands for voice control',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Transcribed speech text to process'
            },
            context: {
              type: 'string',
              description: 'Optional context for the command'
            }
          },
          required: ['text']
        }
      },
      {
        name: 'generate_speech_response',
        description: 'Generate appropriate speech responses for voice interactions',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Message to convert to speech-friendly format'
            },
            tone: {
              type: 'string',
              description: 'Tone for the response (friendly, professional, urgent)',
              enum: ['friendly', 'professional', 'urgent']
            }
          },
          required: ['message']
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
      case 'process_speech_command': {
        const { text, context } = args as { text: string; context?: string };
        
        // Simple command processing logic
        const lowerText = text.toLowerCase();
        let commandType = 'unknown';
        let parameters = {};
        
        if (lowerText.includes('balance') || lowerText.includes('account')) {
          commandType = 'account_query';
          parameters = { type: 'balance' };
        } else if (lowerText.includes('spending') || lowerText.includes('expense')) {
          commandType = 'spending_query';
          parameters = { type: 'expenses' };
        } else if (lowerText.includes('transaction')) {
          commandType = 'transaction_query';
          parameters = { type: 'transactions' };
        } else if (lowerText.includes('house') || lowerText.includes('afford')) {
          commandType = 'affordability_analysis';
          parameters = { type: 'house' };
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                original_text: text,
                command_type: commandType,
                parameters,
                context: context || null,
                confidence: commandType !== 'unknown' ? 0.8 : 0.2
              }, null, 2)
            }
          ]
        };
      }
      
      case 'generate_speech_response': {
        const { message, tone = 'friendly' } = args as { message: string; tone?: string };
        
        // Convert technical/financial data into more conversational language
        let speechFriendlyText = message;
        
        // Replace technical terms with more natural language
        speechFriendlyText = speechFriendlyText
          .replace(/\$(\d+\.?\d*)/g, '$1 dollars')
          .replace(/(\d+)\.(\d{2})/g, '$1 dollars and $2 cents')
          .replace(/account_id/g, 'account')
          .replace(/transaction_id/g, 'transaction')
          .replace(/null/g, 'not available');
        
        // Add tone-appropriate prefixes/suffixes
        switch (tone) {
          case 'friendly':
            speechFriendlyText = `Here's what I found: ${speechFriendlyText}`;
            break;
          case 'professional':
            speechFriendlyText = `Based on your financial data: ${speechFriendlyText}`;
            break;
          case 'urgent':
            speechFriendlyText = `Important: ${speechFriendlyText}`;
            break;
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                original_message: message,
                speech_friendly_text: speechFriendlyText,
                tone,
                estimated_duration_seconds: Math.ceil(speechFriendlyText.split(' ').length / 3) // ~3 words per second
              }, null, 2)
            }
          ]
        };
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: errorMessage }, null, 2)
        }
      ],
      isError: true
    };
  }
});

const transport = new StdioServerTransport();
server.connect(transport);

console.error('Voice MCP server running on stdio'); 