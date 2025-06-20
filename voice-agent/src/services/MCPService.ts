import { MCPClient } from './MCPClient.js';

export class MCPService {
  private client: MCPClient;
  private initialized: boolean = false;

  constructor() {
    this.client = new MCPClient();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('🔧 Initializing MCP service...');
    
    try {
      // Pre-connect to get tools (this establishes the stdio connections)
      await this.client.getAvailableTools();
      this.initialized = true;
      console.log('✅ MCP service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize MCP service:', error);
      throw error;
    }
  }

  getClient(): MCPClient {
    if (!this.initialized) {
      throw new Error('MCP service not initialized. Call initialize() first.');
    }
    return this.client;
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.initialized = false;
      console.log('🔌 MCP service closed');
    }
  }
} 