#!/usr/bin/env tsx

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const testQuestions = [
  {
    name: 'house-affordability',
    text: 'How much house can I afford?'
  },
  {
    name: 'monthly-expenses', 
    text: 'What are my monthly expenses?'
  },
  {
    name: 'retirement-planning',
    text: 'Can I afford to retire early?'
  },
  {
    name: 'account-balances',
    text: 'What are my account balances?'
  },
  {
    name: 'stock-options',
    text: 'What is my stock options portfolio worth?'
  },
  {
    name: 'cash-flow',
    text: 'What is my monthly cash flow?'
  }
];

async function generateAudioFiles(): Promise<void> {
  const audioDir = path.join(__dirname);
  
  // Ensure directory exists
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }

  console.log('🎤 Generating test audio files...\n');

  for (const question of testQuestions) {
    const filename = `${question.name}.wav`;
    const filepath = path.join(audioDir, filename);
    
    // Skip if file already exists
    if (fs.existsSync(filepath)) {
      console.log(`✓ ${filename} (existing)`);
      continue;
    }
    
    try {
      console.log(`🔊 Generating: "${question.text}"`);
      
      // Generate audio using macOS say command
      execSync(`say "${question.text}" -o "${filepath}" --file-format=WAVE`, {
        stdio: 'pipe'
      });
      
      // Optimize for Whisper (16kHz, mono)
      const optimizedPath = filepath.replace('.wav', '-optimized.wav');
      execSync(`ffmpeg -i "${filepath}" -ar 16000 -ac 1 "${optimizedPath}" -y`, {
        stdio: 'pipe'
      });
      
      // Replace original with optimized version
      fs.renameSync(optimizedPath, filepath);
      
      // Check file size
      const stats = fs.statSync(filepath);
      console.log(`✓ ${filename} (${Math.round(stats.size / 1024)}KB)\n`);
      
    } catch (error) {
      console.error(`❌ Failed to generate ${question.name}:`, error);
      throw error;
    }
  }

  console.log(`🎉 Generated ${testQuestions.length} audio files successfully!`);
  console.log(`📁 Files saved in: ${audioDir}`);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateAudioFiles().catch(console.error);
}

export { generateAudioFiles, testQuestions }; 