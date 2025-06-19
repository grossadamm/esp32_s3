import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import { OpenAI } from 'openai';
import { LLMFactory } from '../services/LLMFactory.js';
import { MCPClient } from '../services/MCPClient.js';

const router = Router();
const mcpClient = new MCPClient();

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
      return res.status(400).json({
        error: 'No audio file provided'
      });
    }

    tempFilePath = req.file.path;
    console.log(`[ESP32] Processing audio file: ${req.file.originalname} (${req.file.size} bytes)`);

    // Initialize OpenAI client for Whisper and TTS
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Transcribe audio using Whisper
    let transcription;
    try {
      transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: 'whisper-1',
        language: 'en', // Optional: specify language
        response_format: 'text'
      });
    } catch (whisperError) {
      console.error('[ESP32] Whisper API error:', whisperError);
      throw new Error(`Whisper transcription failed: ${whisperError instanceof Error ? whisperError.message : 'Unknown error'}`);
    }

    console.log(`[ESP32] Transcribed text: ${transcription}`);

    if (!transcription || transcription.trim().length === 0) {
      return res.status(400).json({
        error: 'No speech detected in audio file'
      });
    }

    // Process the transcribed text through the LLM pipeline
    let llmProvider, tools, result;
    try {
      llmProvider = LLMFactory.create();
      tools = await mcpClient.getAvailableTools();
      result = await llmProvider.processText(transcription, tools);
    } catch (llmError) {
      console.error('[ESP32] LLM processing error:', llmError);
      throw new Error(`LLM processing failed: ${llmError instanceof Error ? llmError.message : 'Unknown error'}`);
    }

    console.log(`[ESP32] Generated response: ${result.response}`);
    console.log(`[ESP32] Tools used: ${result.toolsUsed.join(', ')}`);

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

      console.log(`[ESP32] Generated TTS audio: ${responseAudioPath} (${buffer.length} bytes)`);

      // Send the audio file as response
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', buffer.length.toString());
      res.setHeader('X-Transcription', encodeURIComponent(transcription)); // Include transcription in header for debugging
      res.setHeader('X-Tools-Used', encodeURIComponent(result.toolsUsed.join(','))); // Include tools used in header
      
      res.send(buffer);

    } catch (ttsError) {
      console.error('[ESP32] TTS API error:', ttsError);
      throw new Error(`Text-to-speech failed: ${ttsError instanceof Error ? ttsError.message : 'Unknown error'}`);
    }

  } catch (error) {
    console.error('[ESP32] Audio endpoint error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    res.status(500).json({
      error: 'Failed to process audio',
      message: errorMessage
    });
  } finally {
    // Clean up temp files
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`[ESP32] Cleaned up input file: ${tempFilePath}`);
      } catch (cleanupError) {
        console.error('[ESP32] Failed to clean up input file:', cleanupError);
      }
    }
    
    if (responseAudioPath && fs.existsSync(responseAudioPath)) {
      // Clean up the response audio file after a short delay to ensure it was sent
      setTimeout(() => {
        try {
          fs.unlinkSync(responseAudioPath!);
          console.log(`[ESP32] Cleaned up response file: ${responseAudioPath}`);
        } catch (cleanupError) {
          console.error('[ESP32] Failed to clean up response file:', cleanupError);
        }
      }, 1000);
    }
  }
});

export { router as audioESP32Router }; 