# ESP32-S3 Modular Architecture

## Overview

The ESP32-S3 voice agent implements a modular architecture designed for maintainability, testability, and scalability. Each module has clearly defined responsibilities and interfaces, enabling independent development and testing.

## Architecture Principles

### Separation of Concerns
- **Audio Processing**: Isolated from network and application logic
- **Network Communication**: Independent of audio and business logic
- **Wake Word Detection**: Decoupled from audio capture and network transmission
- **System Management**: Centralized initialization and error handling

### Interface-Driven Development
- Well-defined APIs between modules
- Minimal coupling through event-driven communication
- Standard data structures for inter-module communication
- Clear dependency injection patterns

### Resource Management
- Centralized memory allocation and deallocation
- Proper cleanup and resource release
- Buffer pooling for audio data
- Stack and heap monitoring

## Module Structure

```
hardware/esp32-s3/main/
├── main.c                  # Application entry point and main loop
├── system_events.h         # System-wide event definitions
├── audio/                  # Audio processing module
│   ├── audio_manager.c     # Main audio controller
│   ├── audio_input.c       # I2S microphone input
│   ├── audio_output.c      # PWM speaker output  
│   └── audio_processing.c  # Audio signal processing
├── network/                # Network communication module
│   ├── wifi_manager.c      # WiFi connection management
│   ├── websocket_client.c  # WebSocket communication
│   ├── http_client.c       # HTTP client (future use)
│   └── network_config/     # Network configuration
│       ├── wifi_config.c   # WiFi credentials and settings
│       └── server_config.c # Voice agent server configuration
├── wake_word/              # Wake word detection module
│   ├── wake_word_detector.c # Main wake word logic
│   └── wake_word_models.c   # Wake word model management
└── system/                 # System management module
    ├── system_init.c       # System initialization
    └── error_handler.c     # Error handling and recovery
```

## Module Interfaces

### Audio Module (`audio/`)

**Purpose**: Handle all audio input/output and signal processing

**Responsibilities**:
- I2S microphone data capture
- PWM speaker output
- Audio format conversion
- Buffer management
- Audio preprocessing (future: noise reduction, gain control)

**Key APIs**:
```c
// Initialize audio subsystem
esp_err_t audio_init(void);

// Start audio capture
esp_err_t audio_start_capture(void);

// Stop audio capture  
esp_err_t audio_stop_capture(void);

// Get audio data (non-blocking)
esp_err_t audio_get_data(audio_buffer_t* buffer);

// Play audio response
esp_err_t audio_play_response(const uint8_t* data, size_t len);

// Cleanup audio resources
void audio_cleanup(void);
```

**Event Interface**:
- Publishes: `AUDIO_DATA_READY`, `AUDIO_PROCESSING_COMPLETE`
- Subscribes: `AUDIO_INIT`, `AUDIO_OUTPUT_REQUEST`

### Network Module (`network/`)

**Purpose**: Handle all network communication including WiFi and WebSocket

**Responsibilities**:
- WiFi connection management
- WebSocket client implementation
- Network error recovery
- Data transmission to voice agent
- Configuration management

**Key APIs**:
```c
// Initialize network stack
esp_err_t network_init(void);

// Connect to WiFi
esp_err_t network_connect_wifi(const char* ssid, const char* password);

// Connect to WebSocket server
esp_err_t network_connect_websocket(const char* uri);

// Send audio data
esp_err_t network_send_audio(const uint8_t* data, size_t len);

// Receive response data
esp_err_t network_receive_response(uint8_t* buffer, size_t* len);

// Check connection status
bool network_is_connected(void);

// Cleanup network resources
void network_cleanup(void);
```

**Event Interface**:
- Publishes: `NETWORK_CONNECTED`, `WEBSOCKET_CONNECTED`, `STREAM_RESPONSE`
- Subscribes: `NETWORK_INIT`, `STREAM_AUDIO`

### Wake Word Module (`wake_word/`)

**Purpose**: Detect wake words in audio stream

**Responsibilities**:
- Audio stream analysis
- Wake word model management
- Confidence scoring
- False positive reduction
- Integration with ESP-Skainet (future)

**Key APIs**:
```c
// Initialize wake word detection
esp_err_t wake_word_init(void);

// Load wake word models
esp_err_t wake_word_load_models(void);

// Process audio for wake word
esp_err_t wake_word_process(const audio_buffer_t* buffer);

// Set detection sensitivity
esp_err_t wake_word_set_sensitivity(float threshold);

// Get last detection info
wake_word_info_t wake_word_get_last_detection(void);

// Cleanup wake word resources
void wake_word_cleanup(void);
```

**Event Interface**:
- Publishes: `WAKE_WORD_DETECTED`, `WAKE_WORD_TIMEOUT`
- Subscribes: `WAKE_WORD_LISTEN`, `AUDIO_PROCESSING_COMPLETE`

### System Module (`system/`)

**Purpose**: System-wide initialization, configuration, and error handling

**Responsibilities**:
- Hardware initialization
- Module coordination
- Error handling and recovery
- System state management
- Performance monitoring

**Key APIs**:
```c
// Initialize all system components
esp_err_t system_init_all(void);

// Handle system errors
void system_handle_error(system_error_t error);

// Get system status
system_status_t system_get_status(void);

// Restart system
void system_restart(void);

// Get system metrics
system_metrics_t system_get_metrics(void);
```

**Event Interface**:
- Publishes: `SYSTEM_INIT`, `SYSTEM_READY`, `SYSTEM_ERROR`
- Subscribes to all error events from other modules

## Data Structures

### Audio Buffer
```c
typedef struct {
    uint8_t* data;           // Audio sample data
    size_t size;             // Buffer size in bytes
    size_t sample_count;     // Number of audio samples
    uint32_t sample_rate;    // Sample rate (Hz)
    uint8_t channels;        // Number of channels
    uint8_t bits_per_sample; // Bits per sample
    uint32_t timestamp;      // Capture timestamp
} audio_buffer_t;
```

### Wake Word Info
```c
typedef struct {
    bool detected;           // Wake word detected
    float confidence;        // Detection confidence (0.0-1.0)
    uint32_t timestamp;      // Detection timestamp
    char wake_word[32];      // Detected wake word string
    uint32_t duration_ms;    // Detection duration
} wake_word_info_t;
```

### Network Status
```c
typedef struct {
    bool wifi_connected;     // WiFi status
    bool websocket_connected; // WebSocket status
    char ip_address[16];     // Assigned IP address
    int32_t rssi;            // WiFi signal strength
    uint32_t bytes_sent;     // Total bytes transmitted
    uint32_t bytes_received; // Total bytes received
} network_status_t;
```

### System Status
```c
typedef struct {
    bool initialized;        // System initialization complete
    system_state_t state;    // Current system state
    uint32_t uptime_ms;      // System uptime
    size_t free_heap;        // Available heap memory
    size_t min_free_heap;    // Minimum free heap seen
    uint32_t error_count;    // Total error count
} system_status_t;
```

## Inter-Module Communication

### Event-Driven Architecture
All modules communicate through a centralized event system:

```c
// Event publication
esp_err_t event_publish(event_type_t type, void* data, size_t data_size);

// Event subscription
esp_err_t event_subscribe(event_type_t type, event_handler_t handler);

// Event handling
typedef void (*event_handler_t)(system_event_t* event);
```

### Shared Resources
Some resources are shared between modules with proper synchronization:

- **Audio Buffers**: Shared between audio and network modules
- **Configuration**: Centralized configuration accessible to all modules
- **Logging**: Shared logging system for debugging and monitoring

## Configuration Management

### Compile-Time Configuration
```c
// Audio configuration
#define CONFIG_AUDIO_SAMPLE_RATE    16000
#define CONFIG_AUDIO_CHANNELS       2
#define CONFIG_AUDIO_BITS_PER_SAMPLE 32
#define CONFIG_AUDIO_BUFFER_SIZE    4096

// Network configuration
#define CONFIG_WEBSOCKET_URI        "ws://192.168.1.100:3000/api/audio/realtime"
#define CONFIG_WIFI_RETRY_COUNT     5
#define CONFIG_NETWORK_TIMEOUT_MS   10000

// Wake word configuration
#define CONFIG_WAKE_WORD_MODELS     2
#define CONFIG_WAKE_WORD_THRESHOLD  0.8
#define CONFIG_WAKE_WORD_TIMEOUT_MS 30000

// System configuration
#define CONFIG_SYSTEM_STACK_SIZE    8192
#define CONFIG_EVENT_QUEUE_SIZE     32
#define CONFIG_LOG_LEVEL           ESP_LOG_INFO
```

### Runtime Configuration
```c
typedef struct {
    // Audio settings
    uint32_t sample_rate;
    uint8_t channels;
    float input_gain;
    float output_volume;
    
    // Network settings
    char wifi_ssid[32];
    char wifi_password[64];
    char websocket_uri[128];
    uint32_t connection_timeout;
    
    // Wake word settings
    float detection_threshold;
    uint32_t timeout_ms;
    bool continuous_listening;
    
    // System settings
    bool debug_logging;
    uint32_t watchdog_timeout;
} system_config_t;
```

## Error Handling Strategy

### Error Categories
1. **Recoverable Errors**: Network disconnections, temporary failures
2. **Critical Errors**: Hardware failures, memory corruption
3. **Configuration Errors**: Invalid settings, missing parameters

### Error Handling Hierarchy
```
Module Level → System Level → Hardware Reset
     ↓              ↓              ↓
  Local Recovery → Global Recovery → Factory Reset
```

### Error Reporting
```c
typedef enum {
    ERROR_LEVEL_INFO,     // Information only
    ERROR_LEVEL_WARNING,  // Warning, system continues
    ERROR_LEVEL_ERROR,    // Error, module recovery attempted
    ERROR_LEVEL_CRITICAL  // Critical, system restart required
} error_level_t;

typedef struct {
    error_level_t level;
    uint32_t code;
    char module[16];
    char message[128];
    uint32_t timestamp;
    void* context;
} system_error_t;
```

## Memory Management

### Memory Allocation Strategy
- **Static Allocation**: For critical buffers and system structures
- **Dynamic Allocation**: For temporary data and variable-size buffers
- **DMA Buffers**: Special handling for I2S and SPI operations

### Memory Pools
```c
// Audio buffer pool
#define AUDIO_BUFFER_POOL_SIZE  8
static audio_buffer_t audio_buffer_pool[AUDIO_BUFFER_POOL_SIZE];

// Network buffer pool  
#define NETWORK_BUFFER_POOL_SIZE 4
static uint8_t network_buffer_pool[NETWORK_BUFFER_POOL_SIZE][MAX_NETWORK_BUFFER_SIZE];
```

### Memory Monitoring
```c
typedef struct {
    size_t total_heap;       // Total heap size
    size_t free_heap;        // Current free heap
    size_t min_free_heap;    // Minimum free heap seen
    size_t max_alloc_size;   // Largest allocation possible
    uint32_t alloc_count;    // Total allocations
    uint32_t free_count;     // Total deallocations
} memory_info_t;
```

## Performance Optimization

### CPU Usage Optimization
- Task priorities optimized for real-time audio processing
- CPU affinity for audio tasks on dedicated core
- Efficient algorithms for wake word detection
- Minimal context switching in critical paths

### Memory Usage Optimization
- Circular buffers for continuous audio processing
- Zero-copy data passing between modules
- Buffer pooling to reduce allocation overhead
- Stack size optimization for each task

### Power Management
- Dynamic frequency scaling based on processing load
- Sleep modes during idle periods
- Wake word detection with low power consumption
- WiFi power saving when not actively streaming

## Testing Strategy

### Unit Testing
Each module includes comprehensive unit tests:
```c
// Audio module tests
void test_audio_init(void);
void test_audio_capture(void);
void test_audio_playback(void);

// Network module tests
void test_wifi_connection(void);
void test_websocket_communication(void);
void test_network_recovery(void);

// Wake word module tests
void test_wake_word_detection(void);
void test_false_positive_handling(void);
void test_sensitivity_adjustment(void);
```

### Integration Testing
- Cross-module communication testing
- End-to-end audio pipeline testing
- Network connectivity and recovery testing
- System startup and shutdown testing

### Hardware-in-the-Loop Testing
- Real microphone input testing
- Speaker output validation
- Network latency and reliability testing
- Power consumption measurement

## Build System Integration

### CMake Configuration
```cmake
# Module-specific build settings
set(AUDIO_SOURCES
    audio/audio_manager.c
    audio/audio_input.c
    audio/audio_output.c
    audio/audio_processing.c
)

set(NETWORK_SOURCES
    network/wifi_manager.c
    network/websocket_client.c
    network/network_config/wifi_config.c
    network/network_config/server_config.c
)

set(WAKE_WORD_SOURCES
    wake_word/wake_word_detector.c
    wake_word/wake_word_models.c
)

set(SYSTEM_SOURCES
    system/system_init.c
    system/error_handler.c
)
```

### Dependency Management
- Clear dependency graphs between modules
- Proper linking order for static libraries
- External dependency management for ESP-Skainet
- Version control for third-party components

## Future Architecture Enhancements

### Planned Modules
- **Power Management**: Battery monitoring and optimization
- **OTA Update**: Over-the-air firmware updates
- **Security**: Encryption and authentication
- **Diagnostic**: Advanced debugging and telemetry

### Scalability Improvements
- Plugin architecture for wake word models
- Configurable audio processing pipelines
- Dynamic module loading and unloading
- Distributed processing for complex algorithms

### Performance Enhancements
- Hardware acceleration for audio processing
- Optimized memory management with custom allocators
- Real-time operating system integration
- Advanced power management strategies

## References

- [ESP-IDF Component Architecture](https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-guides/build-system.html)
- [FreeRTOS Task Management](https://www.freertos.org/taskandcr.html)
- [Modular Programming Principles](https://en.wikipedia.org/wiki/Modular_programming)
- [ESP32-S3 Technical Reference](https://www.espressif.com/sites/default/files/documentation/esp32-s3_technical_reference_manual_en.pdf)