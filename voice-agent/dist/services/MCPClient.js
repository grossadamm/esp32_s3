import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'fs';
import path from 'path';
export class MCPClient {
    clients = new Map();
    config;
    constructor() {
        // Load MCP configuration - look in parent directory since voice-agent runs from subdirectory
        const configPath = process.env.MCP_CONFIG_PATH || path.join(process.cwd(), '..', 'mcp-config.json');
        this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    async connectToServer(serverName) {
        if (this.clients.has(serverName)) {
            return this.clients.get(serverName);
        }
        const serverConfigs = process.env.NODE_ENV === 'development' && this.config.development
            ? this.config.development
            : this.config.mcpServers;
        const serverConfig = serverConfigs[serverName];
        if (!serverConfig) {
            throw new Error(`Server ${serverName} not found in configuration`);
        }
        // Create MCP client and connect via stdio
        const client = new Client({ name: `voice-agent-client-${serverName}`, version: '1.0.0' }, { capabilities: {} });
        // StdioClientTransport handles spawning the process itself
        const transport = new StdioClientTransport({
            command: serverConfig.command,
            args: serverConfig.args,
            env: {
                ...Object.fromEntries(Object.entries(process.env).filter(([_, v]) => v !== undefined)),
                ...serverConfig.env
            }
        });
        await client.connect(transport);
        this.clients.set(serverName, client);
        console.log(`Connected to MCP server: ${serverName}`);
        return client;
    }
    async getAvailableTools() {
        try {
            const allTools = [];
            // Connect to all configured servers and get their tools
            const serverNames = Object.keys(this.config.mcpServers);
            for (const serverName of serverNames) {
                try {
                    const client = await this.connectToServer(serverName);
                    const toolsResponse = await client.listTools();
                    // Convert MCP tools to our Tool interface
                    const serverTools = toolsResponse.tools.map(tool => ({
                        name: tool.name,
                        description: tool.description || 'No description available',
                        input_schema: tool.inputSchema
                    }));
                    allTools.push(...serverTools);
                    console.log(`Loaded ${serverTools.length} tools from ${serverName}`);
                }
                catch (error) {
                    console.error(`Failed to connect to ${serverName}:`, error);
                    // Continue with other servers even if one fails
                }
            }
            return allTools;
        }
        catch (error) {
            console.error('Failed to get tools from MCP servers:', error);
            throw error;
        }
    }
    async executeTool(name, params = {}) {
        try {
            // Find which server has this tool by checking all connected clients
            for (const [serverName, client] of this.clients) {
                const toolsResponse = await client.listTools();
                const tool = toolsResponse.tools.find(t => t.name === name);
                if (tool) {
                    console.log(`Executing tool ${name} on server ${serverName}`);
                    const result = await client.callTool({ name, arguments: params });
                    return result.content;
                }
            }
            // If no connected server has the tool, try to connect to all servers first
            const serverNames = Object.keys(this.config.mcpServers);
            for (const serverName of serverNames) {
                if (!this.clients.has(serverName)) {
                    try {
                        await this.connectToServer(serverName);
                    }
                    catch (error) {
                        console.error(`Failed to connect to ${serverName}:`, error);
                        continue;
                    }
                }
            }
            // Try again after connecting to all servers
            for (const [serverName, client] of this.clients) {
                const toolsResponse = await client.listTools();
                const tool = toolsResponse.tools.find(t => t.name === name);
                if (tool) {
                    console.log(`Executing tool ${name} on server ${serverName}`);
                    const result = await client.callTool({ name, arguments: params });
                    return result.content;
                }
            }
            throw new Error(`Tool ${name} not found on any connected MCP server`);
        }
        catch (error) {
            console.error(`Failed to execute tool ${name}:`, error);
            throw error;
        }
    }
    async close() {
        // Close all MCP client connections (transport handles process cleanup)
        for (const [serverName, client] of this.clients) {
            try {
                await client.close();
                console.log(`Closed connection to ${serverName}`);
            }
            catch (error) {
                console.error(`Error closing connection to ${serverName}:`, error);
            }
        }
        this.clients.clear();
    }
}
//# sourceMappingURL=MCPClient.js.map