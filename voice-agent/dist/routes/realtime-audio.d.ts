export declare class RealtimeAudioService {
    private wss;
    private mcpClient;
    private openai;
    constructor();
    initialize(server: any): Promise<void>;
    private handleRealtimeConnection;
    private executeMCPFunction;
    close(): Promise<void>;
}
//# sourceMappingURL=realtime-audio.d.ts.map