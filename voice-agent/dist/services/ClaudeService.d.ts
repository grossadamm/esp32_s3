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
export declare class ClaudeService implements LLMProvider {
    private anthropic;
    private mcpClient;
    constructor();
    processText(text: string, tools: Tool[]): Promise<LLMResponse>;
    getModelName(): string;
}
export {};
//# sourceMappingURL=ClaudeService.d.ts.map