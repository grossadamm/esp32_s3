import { OpenAI } from 'openai';
import { HardwareDetectionService } from './HardwareDetectionService.js';
import { LocalSTTService, STTResult } from './LocalSTTService.js';
import fs from 'fs';

export interface AdaptiveSTTConfig {
  fallbackToCloud: boolean;
  confidenceThreshold: number;
  maxRetries: number;
  preferLocal: boolean;
}

export class AdaptiveSTTService {
  private openai: OpenAI;
  private localSTT?: LocalSTTService;
  private hardwareInfo: any;
  private config: AdaptiveSTTConfig;
  private isInitialized = false;

  constructor(config: Partial<AdaptiveSTTConfig> = {}) {
    this.config = {
      fallbackToCloud: true,
      confidenceThreshold: 0.7,
      maxRetries: 2,
      preferLocal: true,
      ...config
    };

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('🔄 Initializing Adaptive STT Service...');

    // Detect hardware capabilities
    this.hardwareInfo = await HardwareDetectionService.detectHardware();

    // Initialize local STT if GPU is available and preferred
    if (this.hardwareInfo.hasNvidiaGPU && this.config.preferLocal) {
      try {
        this.localSTT = new LocalSTTService();
        await this.localSTT.initialize();
        console.log('✅ Local GPU STT initialized successfully');
      } catch (error) {
        console.warn('⚠️ Local STT initialization failed, will use cloud fallback:', error instanceof Error ? error.message : String(error));
        this.localSTT = undefined;
      }
    }

    // Determine active strategy
    const strategy = this.getActiveStrategy();
    console.log(`🎙️ STT Strategy: ${strategy}`);

    this.isInitialized = true;
  }

  private getActiveStrategy(): string {
    if (this.localSTT) {
      return this.config.fallbackToCloud ? 'Local with Cloud Fallback' : 'Local Only';
    }
    return 'Cloud Only';
  }

  async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < this.config.maxRetries) {
      attempt++;

      try {
        // Try local STT first if available
        if (this.localSTT && this.config.preferLocal) {
          console.log(`🎙️ Attempting local STT (attempt ${attempt})`);
          const result = await this.transcribeLocal(audioBuffer);
          
          // Check confidence threshold
          if (result.confidence === undefined || result.confidence >= this.config.confidenceThreshold) {
            console.log(`✅ Local STT successful (${result.processingTimeMs}ms, confidence: ${result.confidence?.toFixed(2) || 'N/A'})`);
            return result.text;
          } else {
            console.log(`⚠️ Local STT low confidence (${result.confidence.toFixed(2)}), trying cloud fallback`);
            if (!this.config.fallbackToCloud) {
              return result.text; // Return anyway if no fallback allowed
            }
          }
        }

        // Try cloud STT
        console.log(`☁️ Attempting cloud STT (attempt ${attempt})`);
        const cloudResult = await this.transcribeCloud(audioBuffer);
        const totalTime = Date.now() - startTime;
        console.log(`✅ Cloud STT successful (${totalTime}ms total)`);
        return cloudResult;

      } catch (error) {
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

  private async transcribeLocal(audioBuffer: Buffer): Promise<STTResult> {
    if (!this.localSTT) {
      throw new Error('Local STT not available');
    }
    return await this.localSTT.transcribeAudio(audioBuffer);
  }

  private async transcribeCloud(audioBuffer: Buffer): Promise<string> {
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
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  }

  async getStatus(): Promise<{
    hardwareInfo: any;
    localSTTAvailable: boolean;
    activeStrategy: string;
    config: AdaptiveSTTConfig;
  }> {
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

  async healthCheck(): Promise<{
    overall: boolean;
    local: boolean;
    cloud: boolean;
    details: any;
  }> {
    const details: any = {};
    
    // Check local STT
    let localHealthy = false;
    if (this.localSTT) {
      try {
        localHealthy = await this.localSTT.healthCheck();
        details.local = localHealthy ? 'Available' : 'Unhealthy';
             } catch (error) {
         details.local = `Error: ${error instanceof Error ? error.message : String(error)}`;
       }
    } else {
      details.local = 'Not available';
    }

    // Check cloud STT (simple API key check)
    let cloudHealthy = false;
    try {
      cloudHealthy = !!process.env.OPENAI_API_KEY;
      details.cloud = cloudHealthy ? 'Available' : 'No API key';
    } catch {
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
  async transcribeWithMethod(audioBuffer: Buffer, method: 'local' | 'cloud'): Promise<string> {
    if (method === 'local') {
      const result = await this.transcribeLocal(audioBuffer);
      return result.text;
    } else {
      return await this.transcribeCloud(audioBuffer);
    }
  }
} 