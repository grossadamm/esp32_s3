import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider, LLMResponse } from './LLMInterface.js';
import { MCPClient } from './MCPClient.js';

interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export class ClaudeService implements LLMProvider {
  private anthropic: Anthropic;
  private mcpClient: MCPClient;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
    this.mcpClient = new MCPClient();
  }

  async processText(text: string, tools: Tool[]): Promise<LLMResponse> {
    try {
      // Get available tools from finance system
      const availableTools = await this.mcpClient.getAvailableTools();
      
      // Send to Claude with tools
      const response = await this.anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `You are a personal finance assistant. You have access to tools that can query a comprehensive finance system. Answer this query: ${text}`
        }],
        tools: availableTools.map(tool => ({
          name: tool.name,
          description: tool.description,
          input_schema: {
            type: "object" as const,
            properties: tool.input_schema.properties || {},
            required: tool.input_schema.required || []
          }
        }))
      });

      const toolsUsed: string[] = [];
      let finalResponse = '';

      // Handle tool calls
      const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');
      
      if (toolUseBlocks.length > 0) {
        const toolResults = [];
        
        for (const toolUse of toolUseBlocks) {
          if (toolUse.type === 'tool_use') {
            try {
              const result = await this.mcpClient.executeTool(toolUse.name, toolUse.input);
              toolResults.push({
                type: "tool_result" as const,
                tool_use_id: toolUse.id,
                content: JSON.stringify(result)
              });
              toolsUsed.push(toolUse.name);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              toolResults.push({
                type: "tool_result" as const,
                tool_use_id: toolUse.id,
                content: `Error executing tool: ${errorMessage}`
              });
            }
          }
        }

        // Send results back to Claude for final response
        const finalResponseMessage = await this.anthropic.messages.create({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: `You are a personal finance assistant. Answer this query: ${text}`
            },
            {
              role: "assistant",
              content: response.content
            },
            {
              role: "user",
              content: toolResults
            }
          ]
        });

        finalResponse = finalResponseMessage.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join(' ');
      } else {
        // No tools used, return direct response
        finalResponse = response.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join(' ');
      }

      return {
        response: finalResponse,
        toolsUsed
      };
    } catch (error) {
      console.error('Claude processing error:', error);
      throw new Error(`Failed to process text: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getModelName(): string {
    return process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
  }
} 