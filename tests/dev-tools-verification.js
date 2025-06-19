#!/usr/bin/env node

// Using built-in fetch (Node.js 18+)

const BASE_URL = 'http://localhost:3000';
const TEXT_ENDPOINT = `${BASE_URL}/api/text`;

async function sendTextQuery(text) {
  console.log(`\n🔍 Sending query: "${text}"`);
  
  try {
    const response = await fetch(TEXT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`✅ Response: ${result.response}`);
    console.log(`🔧 Tools used: ${result.toolsUsed.join(', ')}`);
    
    return result;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return null;
  }
}

async function runProjectTests() {
  console.log('🚀 Starting Dev Tools MCP Project Verification Tests');
  console.log('=' .repeat(60));

  // Test 1: Create a project
  console.log('\n📝 Test 1: Create Project');
  await sendTextQuery('Create a new project called "my-test-project"');

  // Wait a bit between tests
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: List projects
  console.log('\n📋 Test 2: List Projects');
  await sendTextQuery('List all my projects');

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 3: Enter/activate a project
  console.log('\n🎯 Test 3: Enter Project');
  await sendTextQuery('Enter the project "my-test-project"');

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 4: List projects again to see active project
  console.log('\n📋 Test 4: List Projects (with active project)');
  await sendTextQuery('Show me all projects and which one is active');

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 5: Leave the current project
  console.log('\n🚪 Test 5: Leave Project');
  await sendTextQuery('Leave the current project');

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 6: Create another project
  console.log('\n📝 Test 6: Create Second Project');
  await sendTextQuery('Create a project named "second-project"');

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 7: List all projects
  console.log('\n📋 Test 7: List All Projects');
  await sendTextQuery('List all projects');

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 8: Delete a project by name
  console.log('\n🗑️ Test 8: Delete Project by Name');
  await sendTextQuery('Delete the project called "my-test-project"');

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 9: Delete second project by ID (assuming it will be ID 2)
  console.log('\n🗑️ Test 9: Delete Project by ID');
  await sendTextQuery('Delete project with ID 2');

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 10: Final list to confirm cleanup
  console.log('\n📋 Test 10: Final Project List');
  await sendTextQuery('List all projects to see if they were deleted');

  console.log('\n' + '=' .repeat(60));
  console.log('✅ Project verification tests completed!');
}

// Check if server is running
async function checkServerHealth() {
  try {
    const response = await fetch(`${BASE_URL}/health`, { method: 'GET' });
    if (response.ok) {
      console.log('✅ Server is running');
      return true;
    }
  } catch (error) {
    // Try a basic connection test
    try {
      const response = await fetch(BASE_URL, { method: 'GET' });
      console.log('✅ Server is running (no /health endpoint)');
      return true;
    } catch (connectionError) {
      console.error('❌ Server is not running. Please start the voice-agent server first.');
      console.error('Run: cd voice-agent && npm start');
      return false;
    }
  }
  return false;
}

// Main execution
async function main() {
  console.log('🔍 Checking server status...');
  
  const serverRunning = await checkServerHealth();
  if (!serverRunning) {
    process.exit(1);
  }

  await runProjectTests();
}

// Handle errors and cleanup
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
  process.exit(1);
});

main().catch((error) => {
  console.error('Test execution failed:', error);
  process.exit(1);
}); 