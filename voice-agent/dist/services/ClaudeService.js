import Anthropic from '@anthropic-ai/sdk';
import { MCPClient } from './MCPClient.js';
export class ClaudeService {
    anthropic;
    mcpClient;
    constructor() {
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
        this.mcpClient = new MCPClient();
    }
    async processText(text, tools, isVerbalResponse = false) {
        try {
            // Get available tools from finance system
            const availableTools = await this.mcpClient.getAvailableTools();
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
            // Send to Claude with tools
            const response = await this.anthropic.messages.create({
                model: "claude-3-5-sonnet-20241022",
                max_tokens: 1000,
                messages: [{
                        role: "user",
                        content: isVerbalResponse ? verbalContextPrompt : basePrompt
                    }],
                tools: availableTools.map(tool => ({
                    name: tool.name,
                    description: tool.description,
                    input_schema: {
                        type: "object",
                        properties: tool.input_schema.properties || {},
                        required: tool.input_schema.required || []
                    }
                }))
            });
            const toolsUsed = [];
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
                                type: "tool_result",
                                tool_use_id: toolUse.id,
                                content: JSON.stringify(result)
                            });
                            toolsUsed.push(toolUse.name);
                        }
                        catch (error) {
                            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                            toolResults.push({
                                type: "tool_result",
                                tool_use_id: toolUse.id,
                                content: `Error executing tool: ${errorMessage}`
                            });
                        }
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
                // Send results back to Claude for final response
                const finalResponseMessage = await this.anthropic.messages.create({
                    model: "claude-3-5-sonnet-20241022",
                    max_tokens: 1000,
                    messages: [
                        {
                            role: "user",
                            content: isVerbalResponse ? finalVerbalContextPrompt : baseFinalPrompt
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
            }
            else {
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
        }
        catch (error) {
            console.error('Claude processing error:', error);
            throw new Error(`Failed to process text: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    getModelName() {
        return process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
    }
}
//# sourceMappingURL=ClaudeService.js.map