import OpenAI from 'openai';
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

export class OpenAIService implements LLMProvider {
  private openai: OpenAI;
  private mcpClient: MCPClient;

  constructor(mcpClient: MCPClient) {
    this.mcpClient = mcpClient;
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
  }

  async processText(text: string, tools: Tool[], isVerbalResponse: boolean = false): Promise<LLMResponse> {
    try {
      const model = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
      
      // Convert tools to OpenAI format
      const openAITools = this.convertToOpenAITools(tools);
      
      const basePrompt = `You are a personal finance assistant. You have access to tools that can query a comprehensive finance system. Answer this query: ${text}`;
      
      const verbalContextPrompt = `You are a personal finance assistant providing VERBAL responses that will be spoken aloud to the user. 

IMPORTANT: Your response will be converted to speech, so:
- Keep responses concise and conversational, typically 1-3 sentences for simple queries
- Use natural, spoken language patterns (avoid bullet points, lists, or complex formatting)
- For quick facts or simple questions, be brief and direct
- Provide longer explanations (2-4 sentences) only when:
  * The user explicitly asks for detailed analysis or explanation
  * Complex financial concepts need clarification
  * Multiple factors need to be considered for decision-making
  * The user asks "why" or "how" questions that require context

You have access to tools that can query a comprehensive finance system. Answer this query: ${text}`;
      
      const response = await this.openai.chat.completions.create({
        model,
        messages: [{
          role: "user",
          content: isVerbalResponse ? verbalContextPrompt : basePrompt
        }],
        tools: openAITools,
        tool_choice: "auto"
      });

      const toolsUsed: string[] = [];
      let finalResponse = '';

      // Handle tool calls
      const toolCalls = response.choices[0].message.tool_calls;
      
      if (toolCalls && toolCalls.length > 0) {
        const toolResults = [];
        
        for (const toolCall of toolCalls) {
          try {
            const params = JSON.parse(toolCall.function.arguments);
            const result = await this.mcpClient.executeTool(toolCall.function.name, params);
            
            toolResults.push({
              tool_call_id: toolCall.id,
              role: "tool" as const,
              content: JSON.stringify(result)
            });
            toolsUsed.push(toolCall.function.name);
          } catch (error) {
            toolResults.push({
              tool_call_id: toolCall.id,
              role: "tool" as const,
              content: `Error executing tool: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
          }
        }

        const baseFinalPrompt = `You are a personal finance assistant. Based on the tool results, provide a clear response to: ${text}`;

        const finalVerbalContextPrompt = `You are a personal finance assistant providing VERBAL responses that will be spoken aloud to the user.

IMPORTANT: Your response will be converted to speech, so:
- Keep responses concise and conversational, typically 1-3 sentences for simple queries
- Use natural, spoken language patterns (avoid bullet points, lists, or complex formatting)
- For quick facts or simple questions, be brief and direct
- Provide longer explanations (2-4 sentences) only when:
  * The user explicitly asks for detailed analysis or explanation
  * Complex financial concepts need clarification
  * Multiple factors need to be considered for decision-making
  * The user asks "why" or "how" questions that require context

Based on the tool results, provide a clear, spoken response to: ${text}`;

        // Send results back to OpenAI for final response
        const finalResponseMessage = await this.openai.chat.completions.create({
          model,
          messages: [
            {
              role: "user",
              content: isVerbalResponse ? finalVerbalContextPrompt : baseFinalPrompt
            },
            response.choices[0].message,
            ...toolResults
          ]
        });

        finalResponse = finalResponseMessage.choices[0].message.content || '';
      } else {
        // No tools used, return direct response
        finalResponse = response.choices[0].message.content || '';
      }

      return {
        response: finalResponse,
        toolsUsed
      };
    } catch (error) {
      console.error('OpenAI processing error:', error);
      throw new Error(`Failed to process text: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getModelName(): string {
    return process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
  }

  private convertToOpenAITools(tools: Tool[]): OpenAI.Chat.ChatCompletionTool[] {
    return tools.map(tool => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema
      }
    }));
  }
} 