export interface STTResult {
    text: string;
    confidence?: number;
    processingTimeMs: number;
}
export declare class LocalSTTService {
    private isInitialized;
    private modelPath?;
    private hardwareInfo;
    constructor();
    initialize(): Promise<void>;
    private checkPythonDependencies;
    transcribeAudio(audioBuffer: Buffer): Promise<STTResult>;
    private runWhisperInference;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=LocalSTTService.d.ts.map