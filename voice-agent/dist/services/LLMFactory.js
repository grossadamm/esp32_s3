import { ClaudeService } from './ClaudeService.js';
import { OpenAIService } from './OpenAIService.js';
export class LLMFactory {
    static create() {
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
//# sourceMappingURL=LLMFactory.js.map