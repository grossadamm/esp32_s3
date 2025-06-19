import { Router } from 'express';
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
            'audio/x-aiff'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error(`Invalid audio format: ${file.mimetype}. Supported: WAV, MP3, MP4, M4A, WebM, OGG, AIFF`));
        }
    }
});
router.post('/', upload.single('audio'), async (req, res) => {
    let tempFilePath;
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No audio file provided'
            });
        }
        tempFilePath = req.file.path;
        console.log(`Processing audio file: ${req.file.originalname} (${req.file.size} bytes)`);
        // Initialize OpenAI client for Whisper
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
        }
        catch (whisperError) {
            console.error('Whisper API error:', whisperError);
            throw new Error(`Whisper transcription failed: ${whisperError instanceof Error ? whisperError.message : 'Unknown error'}`);
        }
        console.log(`Transcribed text: ${transcription}`);
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
        }
        catch (llmError) {
            console.error('LLM processing error:', llmError);
            throw new Error(`LLM processing failed: ${llmError instanceof Error ? llmError.message : 'Unknown error'}`);
        }
        const response = {
            transcription: transcription,
            response: result.response,
            toolsUsed: result.toolsUsed
        };
        res.json(response);
    }
    catch (error) {
        console.error('Audio endpoint error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({
            error: 'Failed to process audio',
            message: errorMessage
        });
    }
    finally {
        // Clean up temp file
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath);
                console.log(`Cleaned up temp file: ${tempFilePath}`);
            }
            catch (cleanupError) {
                console.error('Failed to clean up temp file:', cleanupError);
            }
        }
    }
});
export { router as audioRouter };
//# sourceMappingURL=audio.js.map