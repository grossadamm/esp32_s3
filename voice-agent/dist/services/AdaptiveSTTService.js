import { OpenAI } from 'openai';
import { HardwareDetectionService } from './HardwareDetectionService.js';
import { LocalSTTService } from './LocalSTTService.js';
import fs from 'fs';
export class AdaptiveSTTService {
    openai;
    localSTT;
    hardwareInfo;
    config;
    isInitialized = false;
    constructor(config = {}) {
        this.config = {
            fallbackToCloud: true,
            confidenceThreshold: 0.7,
            maxRetries: 2,
            preferLocal: process.env.STT_PREFER_LOCAL !== 'false',
            ...config
        };
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }
    async initialize() {
        if (this.isInitialized)
            return;
        console.log('🔄 Initializing Adaptive STT Service...');
        // Detect hardware capabilities
        this.hardwareInfo = await HardwareDetectionService.detectHardware();
        // Initialize local STT if GPU is available and preferred
        if (this.hardwareInfo.hasNvidiaGPU && this.config.preferLocal) {
            try {
                this.localSTT = new LocalSTTService();
                await this.localSTT.initialize();
                console.log('✅ Local GPU STT initialized successfully');
            }
            catch (error) {
                console.warn('⚠️ Local STT initialization failed, will use cloud fallback:', error instanceof Error ? error.message : String(error));
                this.localSTT = undefined;
            }
        }
        // Determine active strategy
        const strategy = this.getActiveStrategy();
        console.log(`🎙️ STT Strategy: ${strategy}`);
        this.isInitialized = true;
    }
    getActiveStrategy() {
        if (this.localSTT) {
            return this.config.fallbackToCloud ? 'Local with Cloud Fallback' : 'Local Only';
        }
        return 'Cloud Only';
    }
    async transcribeAudio(audioBuffer) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        const startTime = Date.now();
        let attempt = 0;
        let lastError = null;
        while (attempt < this.config.maxRetries) {
            attempt++;
            try {
                // Choose STT order based on preference
                if (this.config.preferLocal && this.localSTT) {
                    console.log(`🎙️ Attempting local STT (attempt ${attempt})`);
                    const result = await this.transcribeLocal(audioBuffer);
                    // Check confidence threshold
                    if (result.confidence === undefined || result.confidence >= this.config.confidenceThreshold) {
                        console.log(`✅ Local STT successful (${result.processingTimeMs}ms, confidence: ${result.confidence?.toFixed(2) || 'N/A'})`);
                        return result.text;
                    }
                    else {
                        console.log(`⚠️ Local STT low confidence (${result.confidence.toFixed(2)}), trying cloud fallback`);
                        if (!this.config.fallbackToCloud) {
                            return result.text; // Return anyway if no fallback allowed
                        }
                    }
                }
                // Try cloud STT (either as primary choice or fallback)
                console.log(`☁️ Attempting cloud STT (attempt ${attempt})`);
                const cloudResult = await this.transcribeCloud(audioBuffer);
                const totalTime = Date.now() - startTime;
                console.log(`✅ Cloud STT successful (${totalTime}ms total)`);
                return cloudResult;
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                console.error(`❌ STT attempt ${attempt} failed:`, lastError.message);
                if (attempt >= this.config.maxRetries) {
                    break;
                }
                // Brief delay before retry
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        // All attempts failed
        throw new Error(`STT failed after ${this.config.maxRetries} attempts. Last error: ${lastError?.message}`);
    }
    async transcribeLocal(audioBuffer) {
        if (!this.localSTT) {
            throw new Error('Local STT not available');
        }
        return await this.localSTT.transcribeAudio(audioBuffer);
    }
    async transcribeCloud(audioBuffer) {
        // Create temporary file for OpenAI API
        const tempFilePath = `uploads/temp-cloud-stt-${Date.now()}.wav`;
        try {
            fs.writeFileSync(tempFilePath, audioBuffer);
            const transcription = await this.openai.audio.transcriptions.create({
                file: fs.createReadStream(tempFilePath),
                model: 'whisper-1',
                language: 'en',
                response_format: 'text'
            });
            return transcription.trim();
        }
        finally {
            // Clean up temp file
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }
    }
    async getStatus() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        return {
            hardwareInfo: this.hardwareInfo,
            localSTTAvailable: !!this.localSTT,
            activeStrategy: this.getActiveStrategy(),
            config: this.config
        };
    }
    async healthCheck() {
        const details = {};
        // Check local STT
        let localHealthy = false;
        if (this.localSTT) {
            try {
                localHealthy = await this.localSTT.healthCheck();
                details.local = localHealthy ? 'Available' : 'Unhealthy';
            }
            catch (error) {
                details.local = `Error: ${error instanceof Error ? error.message : String(error)}`;
            }
        }
        else {
            details.local = 'Not available';
        }
        // Check cloud STT (simple API key check)
        let cloudHealthy = false;
        try {
            cloudHealthy = !!process.env.OPENAI_API_KEY;
            details.cloud = cloudHealthy ? 'Available' : 'No API key';
        }
        catch {
            details.cloud = 'Error';
        }
        const overall = localHealthy || cloudHealthy;
        return {
            overall,
            local: localHealthy,
            cloud: cloudHealthy,
            details
        };
    }
    // Method to force a specific STT method (for testing)
    async transcribeWithMethod(audioBuffer, method) {
        if (method === 'local') {
            const result = await this.transcribeLocal(audioBuffer);
            return result.text;
        }
        else {
            return await this.transcribeCloud(audioBuffer);
        }
    }
}
//# sourceMappingURL=AdaptiveSTTService.js.map