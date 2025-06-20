import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { HardwareDetectionService } from './HardwareDetectionService.js';
export class LocalSTTService {
    isInitialized = false;
    modelPath;
    hardwareInfo;
    constructor() {
        this.hardwareInfo = HardwareDetectionService.getHardwareInfo();
    }
    async initialize() {
        if (this.isInitialized)
            return;
        console.log('🎙️ Initializing Local STT Service...');
        if (!this.hardwareInfo?.hasNvidiaGPU) {
            throw new Error('Local STT requires NVIDIA GPU acceleration');
        }
        // Check if we have the necessary Python dependencies
        try {
            await this.checkPythonDependencies();
            this.isInitialized = true;
            console.log('✅ Local STT Service initialized successfully');
        }
        catch (error) {
            console.error('❌ Failed to initialize Local STT Service:', error);
            throw error;
        }
    }
    async checkPythonDependencies() {
        return new Promise((resolve, reject) => {
            const pythonCheck = spawn('python3', ['-c', `
import sys
try:
    import torch
    import whisper
    import onnxruntime as ort
    
    # Check for GPU availability
    if torch.cuda.is_available():
        print("CUDA_AVAILABLE=true")
        print(f"GPU_COUNT={torch.cuda.device_count()}")
    else:
        print("CUDA_AVAILABLE=false")
    
    # Check ONNX Runtime providers
    providers = ort.get_available_providers()
    if 'CUDAExecutionProvider' in providers:
        print("ONNX_CUDA=true")
    else:
        print("ONNX_CUDA=false")
        
    print("DEPENDENCIES_OK=true")
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
                    console.log('📦 Python dependencies check passed:');
                    console.log(output.trim());
                    resolve();
                }
                else {
                    reject(new Error(`Python dependency check failed: ${error || output}`));
                }
            });
        });
    }
    async transcribeAudio(audioBuffer) {
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
        }
        finally {
            // Clean up temporary file
            if (existsSync(tempAudioPath)) {
                unlinkSync(tempAudioPath);
            }
        }
    }
    async runWhisperInference(audioPath) {
        return new Promise((resolve, reject) => {
            const pythonScript = `
import whisper
import torch
import sys
import json

def main():
    try:
        # Load model with GPU if available
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Using device: {device}", file=sys.stderr)
        
        # Use whisper-small for good balance of speed/accuracy on Jetson
        model = whisper.load_model("small", device=device)
        
        # Transcribe
        result = model.transcribe("${audioPath}", language="en")
        
        # Extract confidence if available (newer Whisper versions)
        confidence = None
        if hasattr(result, 'segments') and result.segments:
            avg_confidence = sum(seg.get('avg_logprob', 0) for seg in result.segments) / len(result.segments)
            # Convert log prob to approximate confidence (0-1)
            confidence = max(0, min(1, (avg_confidence + 1) / 2))
        
        output = {
            "text": result["text"].strip(),
            "confidence": confidence
        }
        
        print(json.dumps(output))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
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
                            reject(new Error(result.error));
                        }
                        else {
                            resolve(result);
                        }
                    }
                    catch (parseError) {
                        reject(new Error(`Failed to parse Whisper output: ${parseError}`));
                    }
                }
                else {
                    reject(new Error(`Whisper process failed with code ${code}: ${error}`));
                }
            });
            // Set timeout for inference
            setTimeout(() => {
                pythonProcess.kill();
                reject(new Error('Whisper inference timed out'));
            }, 30000); // 30 second timeout
        });
    }
    async healthCheck() {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }
            return true;
        }
        catch {
            return false;
        }
    }
}
//# sourceMappingURL=LocalSTTService.js.map