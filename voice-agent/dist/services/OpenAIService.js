import OpenAI from 'openai';
import { MCPClient } from './MCPClient.js';
export class OpenAIService {
    openai;
    mcpClient;
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
        this.mcpClient = new MCPClient();
    }
    async processText(text, tools) {
        try {
            const model = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
            // Convert tools to OpenAI format
            const openAITools = this.convertToOpenAITools(tools);
            const response = await this.openai.chat.completions.create({
                model,
                messages: [{
                        role: "user",
                        content: `You are a personal finance assistant. You have access to tools that can query a comprehensive finance system. Answer this query: ${text}`
                    }],
                tools: openAITools,
                tool_choice: "auto"
            });
            const toolsUsed = [];
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
                            role: "tool",
                            content: JSON.stringify(result)
                        });
                        toolsUsed.push(toolCall.function.name);
                    }
                    catch (error) {
                        toolResults.push({
                            tool_call_id: toolCall.id,
                            role: "tool",
                            content: `Error executing tool: ${error instanceof Error ? error.message : 'Unknown error'}`
                        });
                    }
                }
                // Send results back to OpenAI for final response
                const finalResponseMessage = await this.openai.chat.completions.create({
                    model,
                    messages: [
                        {
                            role: "user",
                            content: `You are a personal finance assistant. Answer this query: ${text}`
                        },
                        response.choices[0].message,
                        ...toolResults
                    ]
                });
                finalResponse = finalResponseMessage.choices[0].message.content || '';
            }
            else {
                // No tools used, return direct response
                finalResponse = response.choices[0].message.content || '';
            }
            return {
                response: finalResponse,
                toolsUsed
            };
        }
        catch (error) {
            console.error('OpenAI processing error:', error);
            throw new Error(`Failed to process text: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    getModelName() {
        return process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
    }
    convertToOpenAITools(tools) {
        return tools.map(tool => ({
            type: "function",
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.input_schema
            }
        }));
    }
}
//# sourceMappingURL=OpenAIService.js.map