import { LLMProvider } from './LLMInterface.js';
import { ClaudeService } from './ClaudeService.js';
import { OpenAIService } from './OpenAIService.js';
import { MCPClient } from './MCPClient.js';

export class LLMFactory {
  static create(mcpClient: MCPClient): LLMProvider {
    const provider = process.env.LLM_PROVIDER || 'claude';
    
    switch (provider.toLowerCase()) {
      case 'openai':
        return new OpenAIService(mcpClient);
      case 'claude':
      default:
        return new ClaudeService(mcpClient);
    }
  }
} 