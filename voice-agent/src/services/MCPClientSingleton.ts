import { MCPClient } from './MCPClient.js';

class MCPClientSingleton {
  private static instance: MCPClient | null = null;
  private static initPromise: Promise<MCPClient> | null = null;

  static async getInstance(): Promise<MCPClient> {
    if (this.instance) {
      return this.instance;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.initialize();
    return this.initPromise;
  }

  private static async initialize(): Promise<MCPClient> {
    if (this.instance) {
      return this.instance;
    }

    console.log('🔧 Initializing singleton MCP client...');
    this.instance = new MCPClient();
    
    // Pre-connect to get tools (this establishes the stdio connections)
    try {
      await this.instance.getAvailableTools();
      console.log('✅ MCP client singleton ready');
    } catch (error) {
      console.error('❌ Failed to initialize MCP client singleton:', error);
      this.instance = null;
      this.initPromise = null;
      throw error;
    }

    return this.instance;
  }

  static async close(): Promise<void> {
    if (this.instance) {
      await this.instance.close();
      this.instance = null;
      this.initPromise = null;
      console.log('🔌 MCP client singleton closed');
    }
  }
}

export { MCPClientSingleton }; 