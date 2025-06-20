import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { createTextRouter } from './routes/text';
import { createAudioRouter } from './routes/audio';
import { RealtimeAudioService } from './routes/realtime-audio';
import { FileCleanupService } from './services/FileCleanupService';
import { HardwareDetectionService } from './services/HardwareDetectionService';
import { AdaptiveSTTService } from './services/AdaptiveSTTService';
import { createSystemError } from './utils/errorUtils';
import { logError, logInfo, logWarning } from './utils/logger';
import { MCPService } from './services/MCPService';

dotenv.config();

const app = express();
const server = createServer(app);
const port = process.env.PORT || 3000;

// Initialize MCP Service
const mcpService = new MCPService();

// Initialize Realtime Audio Service
const realtimeAudioService = new RealtimeAudioService(mcpService);

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

// Routes will be set up after MCP service initialization

// Test Realtime Client on root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../test-realtime-client.html'));
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
    
    // Initialize MCP service first (needed by LLM services and routes)
    await mcpService.initialize();
    
    // Set up routes after MCP service is ready
    app.use('/api/text', createTextRouter(mcpService));
    app.use('/api/audio', createAudioRouter(mcpService));
    
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
    await mcpService.close();
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
    await mcpService.close();
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
  
  // Initialize services first (including MCP service)
  await initializeServices();
  
  // Initialize realtime audio service after MCP service is ready
  await realtimeAudioService.initialize(server);
}); 