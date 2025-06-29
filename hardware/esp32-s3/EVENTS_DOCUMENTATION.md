# ESP32-S3 Event System Documentation

## Overview

The ESP32-S3 voice agent uses a modular event-driven architecture to handle audio processing, wake word detection, and network communication. This document outlines the event system that coordinates between different modules.

## Event Types

### System Events

#### SYSTEM_INIT
- **Trigger**: System startup
- **Handler**: `system/system_init.c`
- **Purpose**: Initialize hardware peripherals and system state
- **Next Events**: `AUDIO_INIT`, `NETWORK_INIT`

#### SYSTEM_READY
- **Trigger**: All subsystems initialized
- **Handler**: Main event loop
- **Purpose**: Signal system is ready for operation
- **Next Events**: `WAKE_WORD_LISTEN`

#### SYSTEM_ERROR
- **Trigger**: Critical system failure
- **Handler**: System error handler
- **Purpose**: Handle system-level errors and recovery
- **Actions**: Log error, attempt recovery, or restart system

### Audio Events

#### AUDIO_INIT
- **Trigger**: System initialization
- **Handler**: `audio/audio_manager.c`
- **Purpose**: Initialize I2S peripherals and audio buffers
- **Configuration**: 16kHz, 32-bit stereo input, PWM output

#### AUDIO_DATA_READY
- **Trigger**: I2S DMA buffer full
- **Handler**: Audio processing task
- **Purpose**: New audio samples available for processing
- **Data**: Audio buffer pointer and sample count

#### AUDIO_PROCESSING_COMPLETE
- **Trigger**: Audio processing finished
- **Handler**: Wake word detection or network transmission
- **Purpose**: Audio samples processed and ready for next stage
- **Data**: Processed audio buffer

#### AUDIO_OUTPUT_REQUEST
- **Trigger**: Network receives audio response
- **Handler**: `audio/audio_output.c`
- **Purpose**: Play audio response through PWM speaker
- **Data**: Audio data buffer for playback

### Wake Word Events

#### WAKE_WORD_LISTEN
- **Trigger**: System ready or stream timeout
- **Handler**: `wake_word/wake_word_detector.c`
- **Purpose**: Start listening for wake word detection
- **State**: System enters listening mode

#### WAKE_WORD_DETECTED
- **Trigger**: Wake word detection algorithm
- **Handler**: Main state machine
- **Purpose**: Wake word "Hi ESP" or "Hi Lexin" detected
- **Data**: Confidence score and detection timestamp
- **Next Events**: `STREAM_START`

#### WAKE_WORD_TIMEOUT
- **Trigger**: No wake word detected for extended period
- **Handler**: Power management
- **Purpose**: Optimize power consumption
- **Actions**: Reduce processing frequency or enter low power mode

### Network Events

#### NETWORK_INIT
- **Trigger**: System initialization
- **Handler**: `network/wifi_manager.c`
- **Purpose**: Initialize WiFi connection
- **Configuration**: Connect to configured SSID

#### NETWORK_CONNECTED
- **Trigger**: WiFi connection established
- **Handler**: WebSocket client
- **Purpose**: Network connectivity available
- **Next Events**: `WEBSOCKET_CONNECT`

#### NETWORK_DISCONNECTED
- **Trigger**: WiFi connection lost
- **Handler**: Network recovery
- **Purpose**: Handle network disconnection
- **Actions**: Attempt reconnection, log error

#### WEBSOCKET_CONNECT
- **Trigger**: Network connected
- **Handler**: `network/websocket_client.c`
- **Purpose**: Establish WebSocket connection to voice agent
- **Endpoint**: `ws://[IP]:3000/api/audio/realtime`

#### WEBSOCKET_CONNECTED
- **Trigger**: WebSocket handshake complete
- **Handler**: Main state machine
- **Purpose**: Ready for audio streaming
- **State**: System ready for wake word detection

#### WEBSOCKET_DISCONNECTED
- **Trigger**: WebSocket connection lost
- **Handler**: Connection recovery
- **Purpose**: Handle WebSocket disconnection
- **Actions**: Attempt reconnection, buffer audio data

### Streaming Events

#### STREAM_START
- **Trigger**: Wake word detected
- **Handler**: Audio streaming task
- **Purpose**: Start streaming audio to voice agent
- **Timeout**: 30 seconds maximum streaming window

#### STREAM_AUDIO
- **Trigger**: Audio data ready during streaming
- **Handler**: `network/websocket_client.c`
- **Purpose**: Send audio data to voice agent
- **Format**: Binary WebSocket frames with PCM audio

#### STREAM_RESPONSE
- **Trigger**: Voice agent response received
- **Handler**: Audio output handler
- **Purpose**: Play voice agent response
- **Data**: TTS audio data from voice agent

#### STREAM_END
- **Trigger**: Streaming timeout or voice agent completion
- **Handler**: Main state machine
- **Purpose**: End streaming session
- **Actions**: Close stream, return to wake word listening
- **Next Events**: `WAKE_WORD_LISTEN`

## Event Flow

### Normal Operation Flow

```
SYSTEM_INIT → AUDIO_INIT → NETWORK_INIT → SYSTEM_READY
     ↓
WAKE_WORD_LISTEN → WAKE_WORD_DETECTED → STREAM_START
     ↓
STREAM_AUDIO → STREAM_RESPONSE → AUDIO_OUTPUT_REQUEST → STREAM_END
     ↓
WAKE_WORD_LISTEN (loop back)
```

### Error Recovery Flow

```
SYSTEM_ERROR → Error Logging → Recovery Attempt
     ↓                              ↓
System Restart ← (if recovery fails) → SYSTEM_READY (if successful)
```

### Network Recovery Flow

```
NETWORK_DISCONNECTED → Connection Retry → NETWORK_CONNECTED
     ↓                                          ↓
Continue Offline ← (if retry fails) → WEBSOCKET_CONNECT
```

## Event Implementation

### Event Structure

```c
typedef enum {
    // System events
    SYSTEM_INIT,
    SYSTEM_READY,
    SYSTEM_ERROR,
    
    // Audio events
    AUDIO_INIT,
    AUDIO_DATA_READY,
    AUDIO_PROCESSING_COMPLETE,
    AUDIO_OUTPUT_REQUEST,
    
    // Wake word events
    WAKE_WORD_LISTEN,
    WAKE_WORD_DETECTED,
    WAKE_WORD_TIMEOUT,
    
    // Network events
    NETWORK_INIT,
    NETWORK_CONNECTED,
    NETWORK_DISCONNECTED,
    WEBSOCKET_CONNECT,
    WEBSOCKET_CONNECTED,
    WEBSOCKET_DISCONNECTED,
    
    // Streaming events
    STREAM_START,
    STREAM_AUDIO,
    STREAM_RESPONSE,
    STREAM_END
} event_type_t;

typedef struct {
    event_type_t type;
    void* data;
    size_t data_size;
    uint32_t timestamp;
} system_event_t;
```

### Event Queue

The system uses FreeRTOS queues for event management:

```c
// Main event queue
QueueHandle_t system_event_queue;

// Audio event queue (high priority)
QueueHandle_t audio_event_queue;

// Network event queue
QueueHandle_t network_event_queue;
```

### Event Handlers

Each module implements event handlers:

```c
// Main event dispatcher
void system_event_handler(system_event_t* event);

// Module-specific handlers
void audio_event_handler(system_event_t* event);
void wake_word_event_handler(system_event_t* event);
void network_event_handler(system_event_t* event);
```

## State Machine Integration

The event system drives the main state machine with these states:

- **IDLE**: System startup, waiting for initialization
- **LISTENING**: Wake word detection active
- **STREAMING**: Audio streaming to voice agent
- **PROCESSING**: Voice agent processing request
- **RESPONDING**: Playing voice agent response
- **ERROR**: Error recovery mode

Events trigger state transitions and actions within each state.

## Performance Considerations

### Event Priorities

1. **High Priority**: Audio events (real-time processing)
2. **Medium Priority**: Wake word and streaming events
3. **Low Priority**: System and network management events

### Buffer Management

- Audio events use circular buffers for continuous processing
- Network events use queues with configurable depth
- System events are processed synchronously when possible

### Memory Usage

- Event structures are kept minimal (< 32 bytes)
- Event data uses zero-copy patterns where possible
- Queue sizes are tuned for memory-constrained environment

## Debugging and Monitoring

### Event Logging

Each event is logged with:
- Event type and timestamp
- Source module and handler
- Processing duration
- Data size and content (if enabled)

### Performance Metrics

The system tracks:
- Event processing latency
- Queue depths and overflow conditions
- Memory usage per event type
- Event frequency and patterns

### Debug Configuration

```c
// Enable event logging
#define CONFIG_EVENT_LOGGING 1

// Enable performance metrics
#define CONFIG_EVENT_METRICS 1

// Enable detailed audio event tracing
#define CONFIG_AUDIO_EVENT_TRACE 1
```

## Future Enhancements

### Planned Event Types

- **POWER_MANAGEMENT**: Battery monitoring and power optimization
- **OTA_UPDATE**: Over-the-air firmware updates
- **USER_INPUT**: Physical button or touch input
- **ENVIRONMENTAL**: Temperature, noise level monitoring

### Performance Optimizations

- Event batching for high-frequency events
- Priority-based event scheduling
- Dynamic queue sizing based on load
- Event filtering and aggregation

## References

- [FreeRTOS Queue Management](https://www.freertos.org/a00018.html)
- [ESP32-S3 Event Loop Library](https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-reference/system/esp_event.html)
- [Real-time System Design Patterns](https://en.wikipedia.org/wiki/Real-time_computing)