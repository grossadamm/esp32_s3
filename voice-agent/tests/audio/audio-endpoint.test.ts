import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import axios from 'axios';

describe('Audio Endpoint Tests', () => {
  const baseUrl = 'http://localhost:3000';
  const testAudioDir = path.join(__dirname, '../audio');
  
  const testQuestions = [
    {
      name: 'house-affordability',
      text: 'How much house can I afford?',
      expectedTools: ['house_affordability_analysis']
    },
    {
      name: 'monthly-expenses',
      text: 'What are my monthly expenses?',
      expectedTools: ['query_finance_database']
    },
    {
      name: 'retirement-planning',
      text: 'Can I afford to retire early?',
      expectedTools: ['query_finance_database']
    },
    {
      name: 'account-balances',
      text: 'What are my account balances?',
      expectedTools: ['query_finance_database']
    }
  ];

  beforeAll(async () => {
    // Ensure test audio directory exists
    if (!fs.existsSync(testAudioDir)) {
      fs.mkdirSync(testAudioDir, { recursive: true });
    }

    // Generate test audio files
    console.log('Generating test audio files...');
    await generateTestAudioFiles();
    
    // Wait for server to be ready
    await waitForServer();
  });

  afterAll(() => {
    // Clean up can be optional since we want to keep the files for reuse
    console.log(`Test audio files saved in: ${testAudioDir}`);
  });

  async function generateTestAudioFiles(): Promise<void> {
    for (const question of testQuestions) {
      const filename = `${question.name}.wav`;
      const filepath = path.join(testAudioDir, filename);
      
      // Skip if file already exists
      if (fs.existsSync(filepath)) {
        console.log(`Using existing audio file: ${filename}`);
        continue;
      }
      
      try {
        // Generate audio using macOS say command
        console.log(`Generating audio for: "${question.text}"`);
        execSync(`say "${question.text}" -o "${filepath}" --file-format=WAVE`, {
          stdio: 'pipe'
        });
        
        // Convert to better format for Whisper
        const optimizedPath = filepath.replace('.wav', '-optimized.wav');
        execSync(`ffmpeg -i "${filepath}" -ar 16000 -ac 1 "${optimizedPath}" -y`, {
          stdio: 'pipe'
        });
        
        // Replace original with optimized version
        fs.renameSync(optimizedPath, filepath);
        
        console.log(`Generated: ${filename}`);
      } catch (error) {
        console.error(`Failed to generate audio for ${question.name}:`, error);
        throw error;
      }
    }
  }

  async function waitForServer(maxRetries = 10): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await axios.get(`${baseUrl}/health`);
        console.log('Server is ready');
        return;
      } catch (error) {
        if (i === maxRetries - 1) {
          throw new Error('Server not ready after maximum retries');
        }
        console.log(`Waiting for server... (${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  async function sendAudioRequest(audioFilePath: string): Promise<any> {
    const formData = new FormData();
    formData.append('audio', fs.createReadStream(audioFilePath));
    
    const response = await axios.post(`${baseUrl}/api/audio`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 30000, // 30 second timeout for audio processing
    });
    
    return response.data;
  }

  describe('Audio Processing', () => {
    test.each(testQuestions)('should process audio for $name', async (question) => {
      const audioFile = path.join(testAudioDir, `${question.name}.wav`);
      
      // Verify audio file exists
      expect(fs.existsSync(audioFile)).toBe(true);
      
      // Send audio request
      const response = await sendAudioRequest(audioFile);
      
      // Validate response structure
      expect(response).toHaveProperty('transcription');
      expect(response).toHaveProperty('response');
      expect(response).toHaveProperty('toolsUsed');
      
      // Validate transcription
      expect(response.transcription).toBeTruthy();
      expect(typeof response.transcription).toBe('string');
      expect(response.transcription.trim().length).toBeGreaterThan(0);
      
      // Validate response content
      expect(response.response).toBeTruthy();
      expect(typeof response.response).toBe('string');
      expect(response.response.length).toBeGreaterThan(50); // Substantial response
      
      // Validate tools were used
      expect(Array.isArray(response.toolsUsed)).toBe(true);
      expect(response.toolsUsed.length).toBeGreaterThan(0);
      
      // Check if expected tools were used
      const usedTools = response.toolsUsed;
      const hasExpectedTool = question.expectedTools.some(tool => 
        usedTools.includes(tool)
      );
      expect(hasExpectedTool).toBe(true);
      
      console.log(`✓ ${question.name}: "${response.transcription.trim()}" -> ${usedTools.join(', ')}`);
    }, 45000); // 45 second timeout per test
  });

  describe('Error Handling', () => {
    test('should reject non-audio files', async () => {
      // Create a text file to test rejection
      const textFile = path.join(testAudioDir, 'test.txt');
      fs.writeFileSync(textFile, 'This is not an audio file');
      
      try {
        await sendAudioRequest(textFile);
        fail('Should have rejected non-audio file');
      } catch (error: any) {
        expect(error.response?.status).toBe(400);
        expect(error.response?.data?.error).toContain('Invalid audio format');
      } finally {
        // Clean up
        if (fs.existsSync(textFile)) {
          fs.unlinkSync(textFile);
        }
      }
    });

    test('should handle missing audio file', async () => {
      try {
        const formData = new FormData();
        await axios.post(`${baseUrl}/api/audio`, formData, {
          headers: formData.getHeaders(),
        });
        fail('Should have rejected request without audio file');
      } catch (error: any) {
        expect(error.response?.status).toBe(400);
        expect(error.response?.data?.error).toBe('No audio file provided');
      }
    });
  });

  describe('Audio File Validation', () => {
    test('should have generated all test audio files', () => {
      for (const question of testQuestions) {
        const audioFile = path.join(testAudioDir, `${question.name}.wav`);
        expect(fs.existsSync(audioFile)).toBe(true);
        
        const stats = fs.statSync(audioFile);
        expect(stats.size).toBeGreaterThan(1000); // At least 1KB
        expect(stats.size).toBeLessThan(1024 * 1024); // Less than 1MB
      }
    });

    test('should verify audio file formats', () => {
      for (const question of testQuestions) {
        const audioFile = path.join(testAudioDir, `${question.name}.wav`);
        
        // Check file extension
        expect(path.extname(audioFile)).toBe('.wav');
        
        // Check file exists and has content
        expect(fs.existsSync(audioFile)).toBe(true);
        expect(fs.statSync(audioFile).size).toBeGreaterThan(0);
      }
    });
  });
}); 