import { execSync } from 'child_process';

export interface HardwareInfo {
  hasNvidiaGPU: boolean;
  isJetson: boolean;
  gpuMemory?: number;
  cudaVersion?: string;
  driverVersion?: string;
  jetsonModel?: string;
}

export class HardwareDetectionService {
  private static _hardwareInfo: HardwareInfo | null = null;

  static async detectHardware(): Promise<HardwareInfo> {
    // Return cached result if already detected
    if (this._hardwareInfo !== null) {
      return this._hardwareInfo;
    }

    console.log('🔍 Detecting hardware capabilities...');

    try {
      // Check for nvidia-smi command
      const nvidiaInfo = execSync('nvidia-smi --query-gpu=memory.total,driver_version --format=csv,noheader,nounits', 
        { encoding: 'utf8', timeout: 5000 });
      
      const [memoryMB, driverVersion] = nvidiaInfo.trim().split(', ');
      
      // Check if it's a Jetson device
      let isJetson = false;
      let jetsonModel = '';
      try {
        jetsonModel = execSync('cat /proc/device-tree/model 2>/dev/null || echo "unknown"', 
          { encoding: 'utf8' }).trim();
        isJetson = jetsonModel.toLowerCase().includes('jetson');
      } catch {
        // Not a Jetson or can't read device tree
      }

      // Check CUDA availability
      let cudaVersion = '';
      try {
        cudaVersion = execSync('nvcc --version | grep "release" | sed -n "s/.*release \\([0-9]\\+\\.[0-9]\\+\\).*/\\1/p"', 
          { encoding: 'utf8' }).trim();
      } catch {
        // CUDA not available or nvcc not found
      }

      this._hardwareInfo = {
        hasNvidiaGPU: true,
        isJetson,
        gpuMemory: parseInt(memoryMB) || 0,
        driverVersion,
        cudaVersion: cudaVersion || undefined,
        jetsonModel: isJetson ? jetsonModel : undefined
      };
      
      console.log(`✅ NVIDIA GPU detected:
        ${isJetson ? `🚀 Device: ${jetsonModel}` : '🖥️  Desktop/Server GPU'}
        💾 GPU Memory: ${memoryMB}MB
        🔧 Driver: ${driverVersion}
        ${cudaVersion ? `⚡ CUDA: ${cudaVersion}` : '⚠️  CUDA not detected'}`);

    } catch (error) {
      console.log('ℹ️  No NVIDIA GPU detected, using CPU/Cloud services');
      this._hardwareInfo = {
        hasNvidiaGPU: false,
        isJetson: false
      };
    }

    return this._hardwareInfo;
  }

  static getHardwareInfo(): HardwareInfo | null {
    return this._hardwareInfo;
  }

  static hasNvidiaGPU(): boolean {
    return this._hardwareInfo?.hasNvidiaGPU ?? false;
  }

  static isJetsonDevice(): boolean {
    return this._hardwareInfo?.isJetson ?? false;
  }
} 