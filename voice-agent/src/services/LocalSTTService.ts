import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { HardwareDetectionService } from './HardwareDetectionService.js';

export interface STTResult {
  text: string;
  confidence?: number;
  processingTimeMs: number;
}

export class LocalSTTService {
  private isInitialized = false;
  private modelPath?: string;
  private hardwareInfo: any;

  constructor() {
    this.hardwareInfo = HardwareDetectionService.getHardwareInfo();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('🎙️ Initializing Local STT Service...');
    
    if (!this.hardwareInfo?.hasNvidiaGPU) {
      throw new Error('Local STT requires NVIDIA GPU acceleration');
    }

    // Check if we have the necessary Python dependencies
    try {
      await this.checkPythonDependencies();
      this.isInitialized = true;
      console.log('✅ Local STT Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Local STT Service:', error);
      throw error;
    }
  }

  private async checkPythonDependencies(): Promise<void> {
    return new Promise((resolve, reject) => {
      // In containerized environment, check Python ML packages directly
      const pythonCheck = spawn('python3', ['-c', `
import sys
try:
    import torch
    import whisper
    import onnxruntime as ort
    
    # Check for GPU availability (should work in dusty-nv containers)
    if torch.cuda.is_available():
        print("CUDA_AVAILABLE=true")
        print(f"GPU_COUNT={torch.cuda.device_count()}")
        print(f"DEVICE_NAME={torch.cuda.get_device_name(0)}")
    else:
        print("CUDA_AVAILABLE=false")
    
    # Check ONNX Runtime providers
    providers = ort.get_available_providers()
    if 'CUDAExecutionProvider' in providers:
        print("ONNX_CUDA=true")
    else:
        print("ONNX_CUDA=false")
        
    print("DEPENDENCIES_OK=true")
    print("CONTAINER_TYPE=dusty-nv")
except ImportError as e:
    print(f"MISSING_DEPENDENCY={e}")
    sys.exit(1)
`]);
      
      let output = '';
      let error = '';

      pythonCheck.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonCheck.stderr.on('data', (data) => {
        error += data.toString();
      });

      pythonCheck.on('close', (code) => {
        if (code === 0 && output.includes('DEPENDENCIES_OK=true')) {
          console.log('📦 Containerized GPU dependencies check passed:');
          console.log(output.trim());
          resolve();
        } else {
          reject(new Error(`Python dependency check failed: ${error || output}`));
        }
      });
    });
  }

  async transcribeAudio(audioBuffer: Buffer): Promise<STTResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const tempAudioPath = join(process.cwd(), 'uploads', `temp-stt-${Date.now()}.wav`);

    try {
      // Write audio buffer to temporary file
      writeFileSync(tempAudioPath, audioBuffer);

      const result = await this.runWhisperInference(tempAudioPath);
      const processingTimeMs = Date.now() - startTime;

      console.log(`🎙️ Local STT completed in ${processingTimeMs}ms`);

      return {
        text: result.text,
        confidence: result.confidence,
        processingTimeMs
      };

    } finally {
      // Clean up temporary file
      if (existsSync(tempAudioPath)) {
        unlinkSync(tempAudioPath);
      }
    }
  }

  private async runWhisperInference(audioPath: string): Promise<{ text: string; confidence?: number }> {
    return new Promise((resolve, reject) => {
      console.log(`🚀 Using GPU Whisper (containerized) for: ${audioPath}`);
      
      // In containerized environment, use Whisper directly with GPU
      const pythonScript = `
import whisper
import torch
import sys
import json

def main():
    try:
        # dusty-nv container has proper CUDA setup
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Using device: {device}", file=sys.stderr)
        
        # Use whisper-small for good balance of speed/accuracy on Jetson
        model = whisper.load_model("small", device=device)
        
        # Transcribe
        result = model.transcribe("${audioPath}", language="en")
        
        # Extract confidence if available
        confidence = None
        if hasattr(result, 'segments') and result.segments:
            avg_confidence = sum(seg.get('avg_logprob', 0) for seg in result.segments) / len(result.segments)
            # Convert log prob to approximate confidence (0-1)
            confidence = max(0, min(1, (avg_confidence + 1) / 2))
        
        output = {
            "text": result["text"].strip(),
            "confidence": confidence,
            "device": device,
            "method": "containerized_gpu_whisper"
        }
        
        print(json.dumps(output))
        
    except Exception as e:
        print(json.dumps({"error": str(e), "method": "containerized_gpu_error"}))
        sys.exit(1)

if __name__ == "__main__":
    main()
`;
      
      const pythonProcess = spawn('python3', ['-c', pythonScript]);
      
      let output = '';
      let error = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        error += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output.trim());
            if (result.error) {
              console.log(`⚠️ GPU Whisper error: ${result.error}`);
              reject(new Error(result.error));
            } else {
              console.log(`✅ GPU Whisper success: "${result.text}" (${result.method})`);
              resolve({
                text: result.text,
                confidence: result.confidence || 0.9
              });
            }
          } catch (parseError) {
            reject(new Error(`Failed to parse GPU Whisper output: ${parseError}`));
          }
        } else {
          reject(new Error(`GPU Whisper process failed with code ${code}: ${error}`));
        }
      });

      // Set timeout for inference
      setTimeout(() => {
        pythonProcess.kill();
        reject(new Error('GPU Whisper inference timed out'));
      }, 60000); // 60 second timeout for container startup
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      return true;
    } catch {
      return false;
    }
  }
} 