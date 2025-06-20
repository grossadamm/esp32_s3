export interface LLMResponse {
  response: string;
  toolsUsed: string[];
}

interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface LLMProvider {
  processText(text: string, tools: Tool[], isVerbalResponse?: boolean): Promise<LLMResponse>;
  getModelName(): string;
} 