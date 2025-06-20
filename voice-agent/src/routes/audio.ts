import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import { OpenAI } from 'openai';
import { AdaptiveSTTService } from '../services/AdaptiveSTTService.js';
import { LLMFactory } from '../services/LLMFactory.js';
import { MCPClientSingleton } from '../services/MCPClientSingleton.js';
import { createValidationError, createExternalAPIError, createSystemError } from '../utils/errorUtils.js';
import { logError, logInfo, logWarning } from '../utils/logger.js';

const router = Router();
const adaptiveSTT = new AdaptiveSTTService();

// Configure multer for audio file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit (Whisper's limit)
  },
  storage: multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => {
      // Keep the original extension for OpenAI to recognize the format
      const ext = file.originalname.split('.').pop();
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1E9)}.${ext}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    // Accept common audio formats
    const allowedMimes = [
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'audio/mp3', 
      'audio/mpeg',
      'audio/mp4',
      'audio/m4a',
      'audio/x-m4a',
      'audio/webm',
      'audio/ogg',
      'audio/aiff',
      'audio/x-aiff',
      'application/octet-stream' // Fallback for files with unknown MIME type
    ];
    
    // Check MIME type or file extension
    const ext = file.originalname.toLowerCase().split('.').pop();
    const allowedExtensions = ['wav', 'mp3', 'mp4', 'm4a', 'webm', 'ogg', 'aiff'];
    
    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(ext || '')) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid audio format: ${file.mimetype} (${file.originalname}). Supported: WAV, MP3, MP4, M4A, WebM, OGG, AIFF`));
    }
  }
});

router.post('/', upload.single('audio'), async (req: Request, res: Response) => {
  let tempFilePath: string | undefined;
  let responseAudioPath: string | undefined;
  
  try {
    if (!req.file) {
      return createValidationError(res, 'No audio file provided');
    }

    tempFilePath = req.file.path;
    logInfo('Audio Processing', 'Processing audio file', {
      filename: req.file.originalname,
      size: req.file.size
    });

    // Initialize OpenAI client for TTS
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Transcribe audio using Adaptive STT (GPU or Cloud)
    let transcription;
    try {
      const audioBuffer = fs.readFileSync(tempFilePath);
      transcription = await adaptiveSTT.transcribeAudio(audioBuffer);
    } catch (sttError) {
      logError('STT Processing', sttError);
      return createExternalAPIError(res, 'Speech recognition', sttError);
    }

    logInfo('Audio Processing', `Transcribed text: ${transcription}`);

    if (!transcription || transcription.trim().length === 0) {
      return createValidationError(res, 'No speech detected in audio file');
    }

    // Process the transcribed text through the LLM pipeline
    let llmProvider, tools, result;
    try {
      llmProvider = LLMFactory.create();
      const mcpClient = await MCPClientSingleton.getInstance();
      tools = await mcpClient.getAvailableTools();
      result = await llmProvider.processText(transcription, tools, true); // true for verbal response
    } catch (llmError) {
      logError('LLM Processing', llmError);
      return createExternalAPIError(res, 'Language model', llmError);
    }

    logInfo('Audio Processing', 'Generated response', {
      response: result.response.substring(0, 100) + (result.response.length > 100 ? '...' : ''),
      toolsUsed: result.toolsUsed
    });

    // Convert text response to speech using OpenAI TTS
    try {
      const ttsResponse = await openai.audio.speech.create({
        model: 'tts-1', // or 'tts-1-hd' for higher quality
        voice: 'alloy', // Available voices: alloy, echo, fable, onyx, nova, shimmer
        input: result.response,
        response_format: 'mp3', // ESP32 can handle MP3
        speed: 1.0 // Normal speed
      });

      // Save the audio response to a temporary file
      responseAudioPath = `uploads/tts-${Date.now()}-${Math.round(Math.random() * 1E9)}.mp3`;
      const buffer = Buffer.from(await ttsResponse.arrayBuffer());
      fs.writeFileSync(responseAudioPath, buffer);

      logInfo('Audio Processing', 'Generated TTS audio', {
        audioPath: responseAudioPath,
        size: buffer.length
      });

      // Send the audio file as response
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', buffer.length.toString());
      res.setHeader('X-Transcription', encodeURIComponent(transcription)); // Include transcription in header for debugging
      res.setHeader('X-Tools-Used', encodeURIComponent(result.toolsUsed.join(','))); // Include tools used in header
      
      res.send(buffer);

    } catch (ttsError) {
      logError('TTS Processing', ttsError);
      return createExternalAPIError(res, 'Text-to-speech', ttsError);
    }

  } catch (error) {
    logError('Audio Processing', error);
    createSystemError(res, 'Failed to process audio', error);
  } finally {
    // Clean up temp files
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        logInfo('File Cleanup', `Cleaned up input file: ${tempFilePath}`);
      } catch (cleanupError) {
        logWarning('File Cleanup', 'Failed to clean up input file', { error: cleanupError });
      }
    }
    
    if (responseAudioPath && fs.existsSync(responseAudioPath)) {
      // Clean up the response audio file after a short delay to ensure it was sent
      setTimeout(() => {
        try {
          fs.unlinkSync(responseAudioPath!);
          logInfo('File Cleanup', `Cleaned up response file: ${responseAudioPath}`);
        } catch (cleanupError) {
          logWarning('File Cleanup', 'Failed to clean up response file', { error: cleanupError });
        }
      }, 1000);
    }
  }
});

export { router as audioRouter }; 