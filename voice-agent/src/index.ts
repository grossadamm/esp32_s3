import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { textRouter } from './routes/text.js';
import { audioRouter } from './routes/audio.js';
import { RealtimeAudioService } from './routes/realtime-audio.js';
import { FileCleanupService } from './services/FileCleanupService.js';
import { HardwareDetectionService } from './services/HardwareDetectionService.js';
import { AdaptiveSTTService } from './services/AdaptiveSTTService.js';
import { createSystemError } from './utils/errorUtils.js';
import { logError, logInfo, logWarning } from './utils/logger.js';
import { MCPClientSingleton } from './services/MCPClientSingleton.js';

dotenv.config();

const app = express();
const server = createServer(app);
const port = process.env.PORT || 3000;

// Initialize Realtime Audio Service
const realtimeAudioService = new RealtimeAudioService();

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

// Mobile UI on root path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'mobile-ui.html'));
});

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
    logError('Hardware Detection', error);
    createSystemError(res, 'Failed to detect hardware', error);
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
    logError('STT Status', error);
    createSystemError(res, 'Failed to get STT status', error);
  }
});

// Initialize hardware detection at startup
async function initializeServices() {
  try {
    logInfo('Service Initialization', 'Initializing services...');
    
    // Initialize MCP client singleton first (needed by LLM services)
    await MCPClientSingleton.getInstance();
    
    // Detect hardware capabilities
    const hardwareInfo = await HardwareDetectionService.detectHardware();
    
    // Initialize STT service
    const sttService = new AdaptiveSTTService();
    await sttService.initialize();
    
    logInfo('Service Initialization', 'Services initialized successfully');
  } catch (error) {
    logWarning('Service Initialization', 'Service initialization had issues', { error });
    logInfo('Service Initialization', 'Continuing with available services...');
  }
}

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down Voice Agent...');
  try {
    await realtimeAudioService.close();
    await MCPClientSingleton.close();
    console.log('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down Voice Agent...');
  try {
    await realtimeAudioService.close();
    await MCPClientSingleton.close();
    console.log('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

server.listen(port, async () => {
  console.log(`🤖 Voice Agent running on http://localhost:${port}`);
  console.log(`📱 Mobile UI: http://localhost:${port}/ (open on your phone!)`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`Hardware status: GET http://localhost:${port}/api/hardware-status`);
  console.log(`STT status: GET http://localhost:${port}/api/stt-status`);
  console.log(`Text endpoint: POST http://localhost:${port}/api/text`);
  console.log(`Audio endpoint: POST http://localhost:${port}/api/audio (returns audio)`);
  console.log(`🎙️ Realtime Audio: WebSocket ws://localhost:${port}/api/audio/realtime`);
  
  // Initialize realtime audio service
  await realtimeAudioService.initialize(server);
  
  // Initialize services after server starts
  await initializeServices();
}); 