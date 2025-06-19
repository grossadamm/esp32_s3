# STT Agent Tests

Integration test suite for the voice finance assistant.

## Audio Tests

**Full integration smoke tests** that validate the complete audio processing pipeline:
- Audio file upload → Whisper transcription → LLM analysis → Financial tools

### Prerequisites

1. **STT Agent server** running on `http://localhost:3001`
2. **Finance MCP server** running on `http://localhost:3000`
3. **macOS** with `say` command (for audio generation)
4. **ffmpeg** installed (for audio optimization)

### Running Tests

```bash
# Generate test audio files (first time only)
npm run generate:audio

# Run all audio tests
npm run test:audio

# Run all tests
npm test
```

### Test Audio Files

Generated audio files are saved in `tests/audio/` and preserved in git for reuse:

- `house-affordability.wav` - "How much house can I afford?"
- `monthly-expenses.wav` - "What are my monthly expenses?"
- `retirement-planning.wav` - "Can I afford to retire early?"
- `account-balances.wav` - "What are my account balances?"
- `stock-options.wav` - "What is my stock options portfolio worth?"
- `cash-flow.wav` - "What is my monthly cash flow?"

### Test Coverage

**Audio Processing:**
- ✅ File upload validation
- ✅ Whisper transcription accuracy
- ✅ LLM tool calling
- ✅ Financial analysis integration
- ✅ Response structure validation

**Error Handling:**
- ✅ Invalid file types
- ✅ Missing audio files
- ✅ Server unavailability

**Audio Formats:**
- ✅ WAV file processing
- ✅ 16kHz mono optimization
- ✅ File size validation

### Architecture

Tests use **no mocks** - they validate the complete integration:

```
Audio File → Multer Upload → Whisper API → OpenAI GPT-4 → MCP Client → Finance Server → Database
```

Each test exercises the entire pipeline to ensure real-world functionality. 