import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'fs';
import path from 'path';

interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
  development?: Record<string, MCPServerConfig>;
}

export class MCPClient {
  private clients: Map<string, Client> = new Map();
  private config: MCPConfig;

  constructor() {
    // Load MCP configuration - look in parent directory since voice-agent runs from subdirectory
    const configPath = process.env.MCP_CONFIG_PATH || path.join(process.cwd(), '..', 'mcp-config.json');
    this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  private async connectToServer(serverName: string): Promise<Client> {
    if (this.clients.has(serverName)) {
      return this.clients.get(serverName)!;
    }

    const serverConfigs: Record<string, MCPServerConfig> = process.env.NODE_ENV === 'development' && this.config.development
      ? this.config.development
      : this.config.mcpServers;

    const serverConfig: MCPServerConfig = serverConfigs[serverName];
    if (!serverConfig) {
      throw new Error(`Server ${serverName} not found in configuration`);
    }

    // Create MCP client and connect via stdio
    const client = new Client(
      { name: `voice-agent-client-${serverName}`, version: '1.0.0' },
      { capabilities: {} }
    );

    // StdioClientTransport handles spawning the process itself
    const transport = new StdioClientTransport({
      command: serverConfig.command,
      args: serverConfig.args,
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(([_, v]) => v !== undefined)
        ) as Record<string, string>,
        ...serverConfig.env
      }
    });

    await client.connect(transport);

    this.clients.set(serverName, client);
    console.log(`Connected to MCP server: ${serverName}`);
    return client;
  }

  async getAvailableTools(): Promise<Tool[]> {
    try {
      const allTools: Tool[] = [];

      // Connect to all configured servers and get their tools
      const serverNames = Object.keys(this.config.mcpServers);
      
      for (const serverName of serverNames) {
        try {
          const client = await this.ensureConnection(serverName);
          const toolsResponse = await client.listTools();
          
          // Convert MCP tools to our Tool interface
          const serverTools: Tool[] = toolsResponse.tools.map(tool => ({
            name: tool.name,
            description: tool.description || 'No description available',
            input_schema: tool.inputSchema as any
          }));
          
          allTools.push(...serverTools);
          console.log(`Loaded ${serverTools.length} tools from ${serverName}`);
        } catch (error) {
          console.error(`Failed to connect to ${serverName}:`, error);
          // Continue with other servers even if one fails
        }
      }

      return allTools;
    } catch (error) {
      console.error('Failed to get tools from MCP servers:', error);
      throw error;
    }
  }

  private async ensureConnection(serverName: string): Promise<Client> {
    const client = this.clients.get(serverName);
    if (!client) {
      return await this.connectToServer(serverName);
    }
    
    try {
      // Test the connection by listing tools
      await client.listTools();
      return client;
    } catch (error) {
      console.log(`Connection to ${serverName} dropped, reconnecting...`);
      // Remove the dead connection
      this.clients.delete(serverName);
      // Reconnect
      return await this.connectToServer(serverName);
    }
  }

  async executeTool(name: string, params: any = {}): Promise<any> {
    try {
      // Ensure all servers are connected and find which one has the tool
      const serverNames = Object.keys(this.config.mcpServers);
      
      for (const serverName of serverNames) {
        try {
          const client = await this.ensureConnection(serverName);
          const toolsResponse = await client.listTools();
          const tool = toolsResponse.tools.find(t => t.name === name);
          
          if (tool) {
            console.log(`Executing tool ${name} on server ${serverName}`);
            const result = await client.callTool({ name, arguments: params });
            return result.content;
          }
        } catch (error) {
          console.error(`Failed to execute tool on ${serverName}:`, error);
          // Continue to try other servers
          continue;
        }
      }
      
      throw new Error(`Tool ${name} not found on any MCP server`);
    } catch (error) {
      console.error(`Failed to execute tool ${name}:`, error);
      throw error;
    }
  }

  async close(): Promise<void> {
    // Close all MCP client connections (transport handles process cleanup)
    for (const [serverName, client] of this.clients) {
      try {
        await client.close();
        console.log(`Closed connection to ${serverName}`);
      } catch (error) {
        console.error(`Error closing connection to ${serverName}:`, error);
      }
    }
    
    this.clients.clear();
  }
} 