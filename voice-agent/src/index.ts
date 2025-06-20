import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { textRouter } from './routes/text.js';
import { audioRouter } from './routes/audio.js';
import { FileCleanupService } from './services/FileCleanupService.js';
import { HardwareDetectionService } from './services/HardwareDetectionService.js';
import { AdaptiveSTTService } from './services/AdaptiveSTTService.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Clean uploads directory at startup
FileCleanupService.cleanupUploadsDirectory();

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory');
}

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/text', textRouter);
app.use('/api/audio', audioRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'voice-agent'
  });
});

// Hardware status endpoint
app.get('/api/hardware-status', async (req, res) => {
  try {
    const hardwareInfo = await HardwareDetectionService.detectHardware();
    res.json({
      hardwareInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to detect hardware',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// STT service status endpoint  
app.get('/api/stt-status', async (req, res) => {
  try {
    const sttService = new AdaptiveSTTService();
    const status = await sttService.getStatus();
    const healthCheck = await sttService.healthCheck();
    
    res.json({
      ...status,
      health: healthCheck,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get STT status',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Initialize hardware detection at startup
async function initializeServices() {
  try {
    console.log('🔧 Initializing services...');
    
    // Detect hardware capabilities
    const hardwareInfo = await HardwareDetectionService.detectHardware();
    
    // Initialize STT service
    const sttService = new AdaptiveSTTService();
    await sttService.initialize();
    
    console.log('✅ Services initialized successfully');
  } catch (error) {
    console.warn('⚠️ Service initialization had issues:', error instanceof Error ? error.message : String(error));
    console.log('🔄 Continuing with available services...');
  }
}

app.listen(port, async () => {
  console.log(`🤖 Voice Agent running on http://localhost:${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`Hardware status: GET http://localhost:${port}/api/hardware-status`);
  console.log(`STT status: GET http://localhost:${port}/api/stt-status`);
  console.log(`Text endpoint: POST http://localhost:${port}/api/text`);
  console.log(`Audio endpoint: POST http://localhost:${port}/api/audio (returns audio)`);
  
  // Initialize services after server starts
  await initializeServices();
}); 