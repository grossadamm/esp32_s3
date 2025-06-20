export interface AdaptiveSTTConfig {
    fallbackToCloud: boolean;
    confidenceThreshold: number;
    maxRetries: number;
    preferLocal: boolean;
}
export declare class AdaptiveSTTService {
    private openai;
    private localSTT?;
    private hardwareInfo;
    private config;
    private isInitialized;
    constructor(config?: Partial<AdaptiveSTTConfig>);
    initialize(): Promise<void>;
    private getActiveStrategy;
    transcribeAudio(audioBuffer: Buffer): Promise<string>;
    private transcribeLocal;
    private transcribeCloud;
    getStatus(): Promise<{
        hardwareInfo: any;
        localSTTAvailable: boolean;
        activeStrategy: string;
        config: AdaptiveSTTConfig;
    }>;
    healthCheck(): Promise<{
        overall: boolean;
        local: boolean;
        cloud: boolean;
        details: any;
    }>;
    transcribeWithMethod(audioBuffer: Buffer, method: 'local' | 'cloud'): Promise<string>;
}
//# sourceMappingURL=AdaptiveSTTService.d.ts.map