import { LLMProvider } from './LLMInterface.js';
import { ClaudeService } from './ClaudeService.js';
import { OpenAIService } from './OpenAIService.js';

export class LLMFactory {
  static create(): LLMProvider {
    const provider = process.env.LLM_PROVIDER || 'claude';
    
    switch (provider.toLowerCase()) {
      case 'openai':
        return new OpenAIService();
      case 'claude':
      default:
        return new ClaudeService();
    }
  }
} 