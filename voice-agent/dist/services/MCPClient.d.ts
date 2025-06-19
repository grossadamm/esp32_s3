interface Tool {
    name: string;
    description: string;
    input_schema: {
        type: string;
        properties?: Record<string, any>;
        required?: string[];
    };
}
export declare class MCPClient {
    private baseUrl;
    constructor();
    getAvailableTools(): Promise<Tool[]>;
    executeTool(name: string, params?: any): Promise<any>;
}
export {};
//# sourceMappingURL=MCPClient.d.ts.map