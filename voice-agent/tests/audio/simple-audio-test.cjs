const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

const baseUrl = 'http://localhost:3000';
const testAudioDir = __dirname;

async function testAudioFile(filename, description) {
  console.log(`\n🎤 Testing: ${filename} (${description})`);
  
  const audioFile = path.join(testAudioDir, filename);
  
  if (!fs.existsSync(audioFile)) {
    console.log(`❌ Audio file not found: ${filename}`);
    return;
  }
  
  try {
    const formData = new FormData();
    formData.append('audio', fs.createReadStream(audioFile));
    
    console.log(`📤 Sending audio to ${baseUrl}/api/audio...`);
    
    const response = await axios.post(`${baseUrl}/api/audio`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 30000, // 30 second timeout
    });
    
    const result = response.data;
    
    console.log(`✅ Success!`);
    console.log(`   Transcription: "${result.transcription}"`);
    console.log(`   Tools used: ${result.toolsUsed?.join(', ') || 'none'}`);
    console.log(`   Response length: ${result.response?.length || 0} characters`);
    
    if (result.response) {
      console.log(`   Response preview: ${result.response.substring(0, 150)}...`);
    }
    
    return result;
    
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
    if (error.response?.data) {
      console.log(`   Error details: ${JSON.stringify(error.response.data)}`);
    }
  }
}

async function waitForServer(maxRetries = 5) {
  console.log(`🔍 Checking if voice agent is ready at ${baseUrl}...`);
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.get(`${baseUrl}/health`);
      console.log(`✅ Voice agent is ready! Service: ${response.data.service}`);
      return true;
    } catch (error) {
      if (i === maxRetries - 1) {
        console.log(`❌ Voice agent not ready after ${maxRetries} attempts`);
        console.log(`   Make sure Docker is running: npm run docker:up`);
        return false;
      }
      console.log(`   Attempt ${i + 1}/${maxRetries}... waiting 2s`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

async function main() {
  console.log('🚀 Voice Agent Audio Test');
  console.log('==========================');
  
  // Check if server is ready
  const serverReady = await waitForServer();
  if (!serverReady) {
    process.exit(1);
  }
  
  // Test existing audio files
  await testAudioFile('house-affordability.wav', 'House affordability question');
  await testAudioFile('monthly-expenses.wav', 'Monthly expenses question');
  
  console.log('\n🎉 Audio testing complete!');
}

main().catch(error => {
  console.error('💥 Test failed:', error.message);
  process.exit(1);
}); 