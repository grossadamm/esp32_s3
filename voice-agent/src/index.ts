import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { textRouter } from './routes/text.js';
import { audioDebugRouter } from './routes/audio.js';
import { audioESP32Router } from './routes/audio-esp32.js';
import { FileCleanupService } from './services/FileCleanupService.js';

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
app.use('/api/audio', audioESP32Router);          // Main audio endpoint for ESP32 (returns audio)
app.use('/api/audioDebug', audioDebugRouter);     // Debug endpoint (returns JSON)

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'voice-agent'
  });
});

app.listen(port, () => {
  console.log(`🤖 Voice Agent running on http://localhost:${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`Text endpoint: POST http://localhost:${port}/api/text`);
  console.log(`ESP32 Audio endpoint: POST http://localhost:${port}/api/audio (returns audio)`);
  console.log(`Debug Audio endpoint: POST http://localhost:${port}/api/audioDebug (returns JSON)`);
}); 