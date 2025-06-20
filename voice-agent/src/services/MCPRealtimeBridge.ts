import { MCPClient } from './MCPClient';
import { logInfo, logError } from '../utils/logger';

interface RealtimeTool {
    type: "function";
    name: string;
    description: string;
    parameters: any;
}

interface MCPTool {
    name: string;
    description: string;
    input_schema: any;
}

export class MCPRealtimeBridge {
    private mcpClient: MCPClient;
    private toolCache: Map<string, MCPTool> = new Map();

    constructor(mcpClient: MCPClient) {
        this.mcpClient = mcpClient;
    }

    /**
     * Convert MCP tools to Realtime API format
     */
    async convertMCPToolsToRealtimeFormat(): Promise<RealtimeTool[]> {
        try {
            const mcpTools = await this.mcpClient.getAvailableTools();
            
            // Cache tools for later execution
            mcpTools.forEach((tool: MCPTool) => {
                this.toolCache.set(tool.name, tool);
            });

            const realtimeTools: RealtimeTool[] = mcpTools.map((tool: MCPTool) => ({
                type: "function",
                name: tool.name,
                description: tool.description,
                parameters: tool.input_schema
            }));

            logInfo('MCPRealtimeBridge', `Converted ${realtimeTools.length} MCP tools to Realtime format`);
            return realtimeTools;
            
        } catch (error) {
            logError('MCPRealtimeBridge', 'Failed to convert MCP tools', error);
            return [];
        }
    }

    /**
     * Execute MCP tool and return result
     */
    async executeMCPTool(toolName: string, args: any): Promise<string> {
        const startTime = Date.now();
        
        try {
            // Parse arguments if they come as a JSON string from OpenAI Realtime API
            let parsedArgs = args;
            if (typeof args === 'string') {
                try {
                    parsedArgs = JSON.parse(args);
                } catch (e) {
                    logError('MCPRealtimeBridge', `Failed to parse arguments for ${toolName}`, e);
                    throw new Error(`Invalid arguments format: ${args}`);
                }
            }
            
            logInfo('MCPRealtimeBridge', `Executing MCP tool: ${toolName}`, parsedArgs);
            
            const result = await this.mcpClient.executeTool(toolName, parsedArgs);
            const duration = Date.now() - startTime;
            
            logInfo('MCPRealtimeBridge', `MCP tool ${toolName} executed successfully in ${duration}ms`);
            
            // Return stringified result for Realtime API
            return JSON.stringify(result);
            
        } catch (error) {
            const duration = Date.now() - startTime;
            logError('MCPRealtimeBridge', `MCP tool ${toolName} failed after ${duration}ms`, error);
            
            return JSON.stringify({
                error: 'Tool execution failed',
                message: error instanceof Error ? error.message : String(error),
                toolName,
                duration
            });
        }
    }

    /**
     * Get available tool names
     */
    getAvailableTools(): string[] {
        return Array.from(this.toolCache.keys());
    }

    /**
     * Check if tool exists
     */
    hasTool(toolName: string): boolean {
        return this.toolCache.has(toolName);
    }
} 