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
    private clients;
    private config;
    constructor();
    private connectToServer;
    getAvailableTools(): Promise<Tool[]>;
    executeTool(name: string, params?: any): Promise<any>;
    close(): Promise<void>;
}
export {};
//# sourceMappingURL=MCPClient.d.ts.map