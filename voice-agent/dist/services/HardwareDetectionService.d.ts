export interface HardwareInfo {
    hasNvidiaGPU: boolean;
    isJetson: boolean;
    gpuMemory?: number;
    cudaVersion?: string;
    driverVersion?: string;
    jetsonModel?: string;
}
export declare class HardwareDetectionService {
    private static _hardwareInfo;
    static detectHardware(): Promise<HardwareInfo>;
    static getHardwareInfo(): HardwareInfo | null;
    static hasNvidiaGPU(): boolean;
    static isJetsonDevice(): boolean;
}
//# sourceMappingURL=HardwareDetectionService.d.ts.map