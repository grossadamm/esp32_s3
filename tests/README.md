# Test Suite Documentation

This directory contains verification tests and documentation for the MCP Voice Agent system. The test suite validates both individual components and end-to-end functionality.

## Test Categories

### 1. Dev Tools MCP Verification
Tests for the development tools MCP server project management functionality.

### 2. Voice Agent Integration Tests  
End-to-end tests for the voice agent audio processing pipeline.

### 3. Finance MCP Tests
Validation of financial analysis tools and data import functionality.

### 4. ESP32-S3 Hardware Tests
Hardware-in-the-loop testing for ESP32-S3 audio processing (see `hardware/esp32-s3/`).

## Dev Tools MCP Verification

### Overview
The dev tools verification tests validate all CRUD operations for project management:
- Project creation and deletion
- Project listing and status tracking  
- Active project management (enter/leave)
- Database persistence and error handling

### How Active Project Tracking Works

The active project is tracked **in-memory** within the MCP server process:
- Stored in `ProjectService.currentProject` (private property)
- Set when `enterProject()` is called
- Cleared when `leaveProject()` is called or when the active project is deleted
- **Not persisted** to database - lost when MCP server restarts
- No active project on server startup

### Running Dev Tools Tests

**Option 1: Bash Script (Recommended)**
```bash
./tests/dev-tools-verification.sh
```
- Uses `curl` to send HTTP requests
- Works with any system that has `curl`
- Pretty-prints JSON if `jq` is available
- Includes colored output and better error handling

**Option 2: Node.js Script**
```bash
node tests/dev-tools-verification.js
```
- Uses Node.js built-in fetch (requires Node.js 18+)
- More detailed JSON output formatting

### Test Coverage

The verification tests cover all CRUD operations:

1. **Create Project** - Creates "my-test-project"
2. **List Projects** - Shows all projects (should show 1 project)
3. **Enter Project** - Activates "my-test-project"
4. **List Projects (Active)** - Shows active project status
5. **Leave Project** - Deactivates current project
6. **Create Second Project** - Creates "second-project"
7. **List All Projects** - Shows both projects (should show 2 projects)
8. **Delete by Name** - Deletes "my-test-project"
9. **Delete by ID** - Deletes "second-project" (ID 2)
10. **Final List** - Confirms cleanup (should show 0 projects)

### Expected Behavior

- Projects are created with unique names
- Active project is shown in list results
- Entering a project updates its `updated_at` timestamp
- Deleting the active project automatically deactivates it
- All operations return success/failure status with descriptive messages

## Voice Agent Integration Tests

### Overview
Located in `voice-agent/tests/`, these tests validate the complete audio processing pipeline from file upload through MCP tool execution.

### Test Types

**Audio Processing Tests:**
- File upload validation and format support
- Speech-to-text transcription accuracy
- LLM tool calling and response generation
- Financial analysis integration
- Response structure validation

**Error Handling Tests:**
- Invalid file types and missing files
- Server unavailability scenarios
- Network timeout handling
- MCP server communication failures

### Running Voice Agent Tests

```bash
# Generate test audio files (first time only)
cd voice-agent && npm run generate:audio

# Run audio integration tests
npm run test:audio

# Run all tests
npm test
```

### Test Audio Files

Generated audio files are preserved in `voice-agent/tests/audio/`:

- `house-affordability.wav` - "How much house can I afford?"
- `monthly-expenses.wav` - "What are my monthly expenses?"
- `retirement-planning.wav` - "Can I afford to retire early?"
- `account-balances.wav` - "What are my account balances?"
- `stock-options.wav` - "What is my stock options portfolio worth?"
- `cash-flow.wav` - "What is my monthly cash flow?"

### Integration Test Architecture

Tests use **no mocks** - they validate the complete integration:

```
Audio File → Multer Upload → Whisper API → OpenAI GPT-4 → MCP Client → Finance Server → Database
```

Each test exercises the entire pipeline to ensure real-world functionality.

## Finance MCP Tests

### Amazon Import Testing
The finance MCP includes comprehensive Amazon transaction import testing:

**Test Coverage:**
- CSV file parsing with BOM character handling
- Multi-item order processing with unique keys
- Date validation and fallback logic
- Duplicate prevention by transaction ID
- Financial accounting accuracy (negative purchases, positive refunds)

**Test Data:**
- **Physical Orders**: 3,646+ items imported
- **Returns & Refunds**: Logistics tracking and actual payment processing
- **Digital Purchases**: E-books, music, movies, apps
- **Rentals**: Amazon rental services
- **Concessions**: Customer service credits and replacements

### Database Schema Validation
Tests validate the complete database schema including:

- **accounts**: Bank account data with balances
- **transactions**: Financial transactions with proper categorization
- **amazon_transactions**: Amazon-specific transaction data
- **amazon_import_log**: Import history and statistics

## System Integration Tests

### Prerequisites

1. **Voice Agent server** running on `http://localhost:3000`
2. **MCP servers** available via STDIO (automatically managed by voice agent)
3. **Database access** to `data/finance.db` and `data/projects.db`
4. **Test dependencies** installed (Node.js 18+, curl, jq optional)

### Environment Setup

```bash
# Start the voice agent system
docker compose -f docker-compose.dev.yml up -d

# Verify services are running
curl http://localhost:3000/health

# Check MCP server connectivity
curl -X POST http://localhost:3000/api/text \
  -H "Content-Type: application/json" \
  -d '{"text": "list my projects"}'
```

### Test Execution

**Full Test Suite:**
```bash
# Run all system tests
./tests/dev-tools-verification.sh
cd voice-agent && npm test
```

**Individual Test Categories:**
```bash
# Dev tools MCP only
./tests/dev-tools-verification.sh

# Voice agent audio only  
cd voice-agent && npm run test:audio

# Finance tools (via voice agent)
curl -X POST http://localhost:3000/api/text \
  -H "Content-Type: application/json" \
  -d '{"text": "What are my account balances?"}'
```

## Real-time Audio Testing

### WebSocket Integration Tests
The voice agent includes real-time audio streaming tests:

**Test Client:**
Open `voice-agent/test-realtime-client.html` in browser for interactive testing.

**Features Tested:**
- WebSocket connection establishment
- Real-time audio streaming (bidirectional)
- Live transcription accuracy
- MCP tool integration during conversation
- Voice activity detection
- Error handling and reconnection

**Test Flow:**
1. Connect to WebSocket endpoint
2. Start audio recording (microphone access)
3. Speak test queries ("What's my project status?")
4. Validate live transcription display
5. Receive and play audio responses
6. Test tool execution (projects, finance)

## Performance Testing

### Metrics Tracked
- **Audio Processing Latency**: STT processing time
- **Tool Execution Time**: MCP server response time  
- **End-to-End Response Time**: Complete request-response cycle
- **Memory Usage**: Heap utilization during processing
- **Network Performance**: WebSocket latency and throughput

### Performance Benchmarks
```bash
# Test audio processing performance
time curl -X POST \
  -F "audio=@voice-agent/tests/audio/house-affordability.wav" \
  http://localhost:3000/api/audio \
  --output /dev/null

# Test text processing performance
time curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"text": "What are my monthly expenses?"}' \
  http://localhost:3000/api/text
```

## Troubleshooting Tests

### Common Issues

**Server not running:**
```bash
# Check if voice agent is accessible
curl http://localhost:3000/health

# Start services if needed
docker compose -f docker-compose.dev.yml up -d
```

**MCP connection issues:**
```bash
# Verify MCP configuration
cat mcp-config.json

# Test MCP connectivity
curl -X POST http://localhost:3000/api/text \
  -H "Content-Type: application/json" \
  -d '{"text": "test connection"}'
```

**Database issues:**
```bash
# Check if databases exist
ls -la data/
# Should show finance.db and projects.db

# Test database connectivity
sqlite3 data/projects.db "SELECT COUNT(*) FROM projects;"
```

**Audio test failures:**
```bash
# Verify audio files exist
ls -la voice-agent/tests/audio/

# Regenerate test audio if needed
cd voice-agent && npm run generate:audio
```

### Debug Configuration

**Enable verbose logging:**
```bash
# Voice agent debug mode
DEBUG=* npm run dev

# Docker debug logs
docker compose -f docker-compose.dev.yml logs -f
```

**Test-specific debugging:**
```bash
# Dev tools test with verbose output
bash -x ./tests/dev-tools-verification.sh

# Voice agent tests with debug info
cd voice-agent && DEBUG=* npm test
```

## Test Data Management

### Test Database Setup
Tests use the same databases as production but with safeguards:

- **Read-only access** for most test operations
- **Transactional testing** where writes are rolled back
- **Isolated test data** that doesn't affect real financial data
- **Backup and restore** capabilities for test data

### Cleaning Up Test Data
```bash
# Clean up test projects (safe - only removes test projects)
sqlite3 data/projects.db "DELETE FROM projects WHERE name LIKE '%test%';"

# Verify cleanup
sqlite3 data/projects.db "SELECT * FROM projects;"
```

## Continuous Integration

### Automated Test Execution
Tests are designed to run in CI/CD environments:

```bash
# CI-friendly test execution
export CI=true
./tests/dev-tools-verification.sh
cd voice-agent && npm test -- --ci
```

### Test Reports
Tests generate structured output for CI integration:
- **JUnit XML** format for test results
- **Coverage reports** for code coverage analysis
- **Performance metrics** for regression detection
- **Error logs** for debugging failed tests

## Contributing to Tests

### Adding New Tests

**Dev Tools Tests:**
1. Add new test scenarios to `dev-tools-verification.sh`
2. Update expected behavior documentation
3. Ensure test cleanup (remove created data)

**Voice Agent Tests:**
1. Add test files to `voice-agent/tests/`
2. Generate new test audio if needed
3. Update test documentation and coverage

**Integration Tests:**
1. Consider end-to-end impact of changes
2. Test across all supported platforms
3. Validate performance impact

### Test Best Practices
- **Idempotent tests**: Tests should produce same results on repeated runs
- **Independent tests**: Tests should not depend on each other
- **Comprehensive cleanup**: Remove all test data after execution
- **Clear assertions**: Test expectations should be explicit
- **Performance awareness**: Monitor test execution time and resource usage

## References

- [Jest Testing Framework](https://jestjs.io/) (for voice-agent tests)
- [cURL Documentation](https://curl.se/docs/) (for API testing)
- [SQLite Testing](https://www.sqlite.org/testing.html) (for database tests)
- [WebSocket Testing](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) (for real-time tests) 