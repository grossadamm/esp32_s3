import { LLMProvider, LLMResponse } from './LLMInterface.js';
interface Tool {
    name: string;
    description: string;
    input_schema: {
        type: string;
        properties?: Record<string, any>;
        required?: string[];
    };
}
export declare class OpenAIService implements LLMProvider {
    private openai;
    private mcpClient;
    constructor();
    processText(text: string, tools: Tool[]): Promise<LLMResponse>;
    getModelName(): string;
    private convertToOpenAITools;
}
export {};
//# sourceMappingURL=OpenAIService.d.ts.map