# ESP32-S3 Audio Streaming & Wake Word Detection Project

## Project Overview

This project creates a Node.js-inspired Python-based audio streaming device using an ESP32-S3 microcontroller. The device streams audio from dual MEMS microphones to a remote WebSocket server, receives audio back from the server, and plays it through a 3W speaker. The device features custom wake word detection ("Nebula") using the ESP32-S3's built-in ML capabilities.

## Hardware Components

### Core Components
- **XIAO ESP32S3** - Compact microcontroller with dual-core processor, ML acceleration, **8MB PSRAM, 8MB Flash**
- **2x INMP441 MEMS Microphones** - High-quality I2S digital microphones (5-pack available)
- **1x PAM8403 Amplifier Module** - 3W stereo amplifier (6W total, using one channel) (5-pack available)
- **1-2x 3W Speakers (4Ω)** - Audio output device (2-pack available for stereo option)
- **Breadboard & Jumper Wires** - For prototyping
- **Power Supply** - USB-C or 5V adapter

### Optional Components for Production
- **MAX98357A I2S Amplifier** - Alternative high-quality I2S amplifier
- **Custom PCB** - For final implementation

## Technical Specifications

### XIAO ESP32S3 Capabilities
- **Dual-core Xtensa LX7 @ 240MHz**
- **AI acceleration** for neural network processing
- **Dual I2S peripherals** (I2S0 and I2S1)
- **Built-in DACs** available on breakout pins
- **Wi-Fi and Bluetooth** connectivity
- **512KB SRAM + 8MB PSRAM (built-in)**
- **8MB Flash** (double typical ESP32-S3 boards)
- **Ultra-compact form factor** (21mm x 17.5mm)

### Audio Specifications
- **Sample Rate**: 16kHz (optimized for voice)
- **Bit Depth**: 16-bit
- **Channels**: Stereo input (2 mics), Mono output (1 speaker)
- **Frequency Response**: 60Hz - 15kHz
- **Wake Word Detection**: Custom "Nebula" trigger

## Hardware Connections

### INMP441 Microphone Wiring

#### Microphone 1 (Left Channel)
```
INMP441 Pin → XIAO ESP32S3 Pin → Description
VDD         → 3V3              → Power supply
GND         → GND              → Ground
SD          → GPIO1 (A0)       → Serial Data (I2S)
SCK         → GPIO2 (A1)       → Serial Clock (I2S)
WS          → GPIO3 (A2)       → Word Select (I2S)
L/R         → GND              → Left channel select
```

#### Microphone 2 (Right Channel)
```
INMP441 Pin → XIAO ESP32S3 Pin → Description
VDD         → 3V3              → Power supply
GND         → GND              → Ground
SD          → GPIO1 (A0)       → Serial Data (I2S) - shared
SCK         → GPIO2 (A1)       → Serial Clock (I2S) - shared
WS          → GPIO3 (A2)       → Word Select (I2S) - shared
L/R         → 3V3              → Right channel select
```

### PAM8403 Amplifier Wiring
```
PAM8403 Pin → XIAO ESP32S3 Pin → Description
VCC         → 5V/3.3V          → Power input
GND         → GND              → Ground
L+          → GPIO43 (DAC1)    → Left audio input
R+          → (unused)         → Right audio input
L-          → GND              → Audio ground
R-          → GND              → Audio ground
SPKR L+     → Speaker +        → Speaker positive
SPKR L-     → Speaker -        → Speaker negative
```

### Microphone Array Placement
- **Distance between microphones**: 4-6.5cm
- **Orientation**: Horizontal line, parallel placement
- **Direction**: Both microphones facing the same direction
- **Height**: Same level relative to the surface

## Software Architecture

### Framework Stack
1. **ESP-IDF v5.x** - Base development framework
2. **ESP-Skainet** - Speech recognition framework containing ESP-SR
3. **ESP32-audioI2S** - High-quality audio processing library (alternative)

### Core Components

#### Audio Front-End (AFE)
- **Acoustic Echo Cancellation (AEC)** - Removes speaker echo from microphone input
- **Noise Suppression (NS)** - Reduces background noise
- **Beamforming** - Directional audio processing using dual microphones
- **Voice Activity Detection (VAD)** - Detects speech presence
- **WakeNet Integration** - Custom wake word detection

#### Wake Word Engine Options
**ESP-Skainet/WakeNet:**
- **Models**: WakeNet8 or WakeNet9 (optimized for ESP32-S3)
- **Custom Wake Words**: Up to 5 wake words per model
- **Power**: 20-35mA during detection, 10-150µA in deep sleep
- **Performance**: 3.0-10.0ms processing time per 32ms frame

**Porcupine (Alternative):**
- **Accuracy**: Industry-leading wake word detection
- **Custom training**: "Nebula" through Picovoice Console
- **Resource usage**: 45-85KB RAM, 200-500KB Flash
- **Licensing**: Free tier available, commercial licensing required for production

#### WebSocket Communication
- **Protocol**: WebSocket for real-time bidirectional audio streaming
- **Audio Format**: PCM 16-bit, 16kHz, batched transmission
- **Connection Management**: Auto-reconnect with error handling
- **Buffer Management**: Efficient audio streaming

## Power Management

### Power Consumption Estimates
- **Deep Sleep Mode**: 10-150 µA
- **Wake Word Detection**: 20-35mA (ESP-Skainet) or 20-35mA (Porcupine)
- **Active Audio Streaming**: 150-250mA
- **Speaker Output (3W)**: 600-1000mA peak

### Audio Output Options

#### Direct DAC Output (No Amp)
- **Power**: ~50-80mW output
- **Quality**: Suitable for prototyping and quiet notifications
- **Volume**: Very quiet, not suitable for room-filling audio
- **Pins**: GPIO43 (DAC1), GPIO44 (DAC2) on XIAO ESP32S3

#### PAM8403 Amplifier
- **Power**: 3W per channel (6W total)
- **Input**: ESP32-S3 DAC output or I2S (with modification)
- **Supply**: 5V recommended for dual speakers, 3.3V possible for lower power
- **Quality**: Good for the price point

#### MAX98357A I2S Amplifier (Recommended for Production)
- **Power**: 3.2W output
- **Input**: Direct I2S connection
- **Quality**: Excellent audio quality with hardware I2S interface
- **Cost**: ~$2-3 but significantly better performance

## Speaker Configuration

### Single 3W Speaker (Recommended)
- **Amplifier**: One PAM8403 or MAX98357A
- **Power**: Adequate for room-filling audio
- **Implementation**: Simpler wiring and software
- **Cost**: Lower component count

### Dual 3W Speakers (Optional)
- **Amplifier**: Two MAX98357A modules or dual PAM8403
- **Power**: 5V supply mandatory to avoid overloading ESP32-S3 regulator
- **Channel Selection**: Configure one for left, one for right via SD pin
- **Implementation**: More complex but stereo output

## Microphone Configuration: 2 vs 3 Microphones

### Recommended: 2 Microphones
**Advantages:**
- Standard stereo I2S configuration
- Optimized for ESP-SR framework
- Lower power consumption
- Proven beamforming algorithms
- 4-6.5cm spacing optimal for wake word detection

**Configuration:**
- One microphone left channel (L/R → GND)
- One microphone right channel (L/R → 3.3V)
- Shared I2S bus (SD, SCK, WS)

### Alternative: 3 Microphones
**Advantages:**
- Better spatial audio processing
- 120° triangular array possible
- Enhanced noise rejection

**Disadvantages:**
- More complex I2S configuration required
- Higher power consumption
- ESP-SR framework optimized for 2-mic arrays
- Requires time-division multiplexing or multiple I2S peripherals

## Development Phases - Iterative Approach

### Phase 1: Minimal Hardware Setup (Week 1-2)
**Goal**: Get basic audio input/output working
**Architecture**: Single polling loop, global variables

- [ ] Assemble hardware on breadboard
- [ ] Test I2S microphone input
- [ ] Test DAC audio output with PAM8403 (test both 3.3V and 5V supply)
- [ ] Basic audio loopback test (mic → speaker passthrough)
- [ ] Verify hardware connections work reliably
- [ ] **Add basic memory monitoring** (heap usage tracking)
- [ ] **Implement basic audio buffering** (circular buffers for audio data)

**Simple Code Structure**:
```c
void app_main() {
    init_hardware();
    init_memory_monitoring();  // Track heap usage
    init_audio_buffers();      // Basic circular buffers
    while(1) {
        simple_audio_loop();  // mic → speaker passthrough
        log_memory_usage();   // Periodic memory check
        vTaskDelay(10);
    }
}
```

### Phase 2: Basic Wake Word Detection (Week 3-4)
**Goal**: Detect "Nebula" wake word with simple feedback
**Architecture**: 2 tasks + global flags

- [ ] Setup ESP-Skainet framework
- [ ] Implement basic wake word detection
- [ ] Simple feedback (LED, beep, or serial output)
- [ ] Test wake word accuracy in quiet conditions
- [ ] Verify 3-meter detection range

**Simple Code Structure**:
```c
// Task 1: Audio processing + wake word detection
// Task 2: Main controller (handle wake word events)
// Global: wake_word_detected flag
```

### Phase 3: Basic WebSocket Streaming (Week 5-6)
**Goal**: Bidirectional audio streaming after wake word
**Architecture**: 3 tasks + simple state machine (2 states)

- [ ] Implement basic WebSocket client connection
- [ ] Send audio to server after wake word detection
- [ ] Receive and play audio from server
- [ ] Simple 10-second timeout mechanism
- [ ] Basic connection error handling

**Simple Code Structure**:
```c
// Task 1: Audio processing (mic input + wake word)
// Task 2: WebSocket communication (send/receive audio)
// Task 3: Main controller (simple state machine)
// States: LISTENING, STREAMING
```

### Phase 4: Robustness & Quality (Week 7-8)
**Goal**: Improve reliability and audio quality
**Architecture**: Add queues and better error handling

- [ ] Add proper buffer management with queues
- [ ] Improve WebSocket reconnection logic
- [ ] Enhance audio quality (remove noise, echo)
- [ ] Add proper error recovery mechanisms
- [ ] Performance testing and optimization

**Enhanced Code Structure**:
```c
// Add: FreeRTOS queues for audio data
// Add: Connection retry logic
// Add: Basic AFE processing (noise suppression)
```

### Phase 5: Advanced Features (Week 9-10)
**Goal**: Production-ready features
**Architecture**: Full task structure as needed

- [ ] Implement full AFE algorithms (beamforming, AEC)
- [ ] Add power management and sleep modes
- [ ] Custom "Nebula" wake word training
- [ ] Advanced WebSocket features (compression, etc.)
- [ ] Memory and performance optimization

### Phase 6: Polish & Documentation (Week 11-12)
**Goal**: System integration and documentation
**Architecture**: Final optimizations

- [ ] Complete system integration testing
- [ ] Performance benchmarking
- [ ] Power consumption analysis
- [ ] Code cleanup and documentation
- [ ] Prepare for potential PCB design

## Iterative Architecture Evolution

### Phase 1 Architecture: Single Loop
```c
void app_main(void) {
    init_hardware();
    while (1) {
        simple_audio_loop();  // Basic mic → speaker
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}
```

### Phase 2 Architecture: Basic Tasks
```c
TaskHandle_t audio_task;
TaskHandle_t main_task;
bool wake_word_detected = false;  // Global flag

// 2 tasks + global variables
```

### Phase 3 Architecture: Simple State Machine
```c
typedef enum {
    STATE_LISTENING,
    STATE_STREAMING
} simple_state_t;

simple_state_t current_state = STATE_LISTENING;
// 3 tasks + simple state + WebSocket
```

### Phase 4+ Architecture: Production Ready
```c
// Add as complexity is needed:
// - FreeRTOS queues
// - Proper error handling
// - Buffer management
// - Multiple states
// - Power management
```

## When to Add Complexity

**Add Queues**: When you notice audio dropouts or timing issues
**Add State Machine**: When you need more than 2-3 states  
**Add Buffer Management**: When you run out of memory
**Add Power Management**: When battery life becomes important
**Add Error Recovery**: When connection issues become problematic

## Key Simplifications for Early Phases

1. **No Queues Initially**: Use global variables and flags (but add basic circular buffers)
2. **No Complex State Machine**: Just 2-3 simple states
3. **No Buffer Pools**: Use static buffers with memory monitoring
4. **No Power Management**: Focus on functionality first
5. **Minimal Error Handling**: Power cycle on WebSocket disconnect
6. **Fixed Timeouts**: Hard-coded 10-second streaming window

## Design Decisions & Trade-offs

### **Dual Microphone Rationale**
- **Enhanced recording capabilities**: Stereo capture provides more audio information
- **Beamforming potential**: Even basic directional processing helps with noise
- **ESP-SR optimization**: Framework designed for 2-mic arrays
- **Minimal complexity**: Same I2S bus, just different L/R channel selection
- **Cost**: Only ~$3 extra for significant audio improvement

### **Error Handling Strategy**
- **Early phases**: Power cycle on major errors (WebSocket disconnect, etc.)
- **Production**: Implement graceful recovery in later phases
- **Rationale**: Focus on core functionality first, robustness later

### **Audio Quality Approach**
- **Early phases**: Ignore quality optimization, focus on functionality
- **Production**: Add AFE algorithms, noise suppression, echo cancellation
- **Rationale**: Get working system first, then optimize

## Performance Targets

### Wake Word Performance
- **ESP-Skainet**: 96-99% detection rate, <1 false positive per 12 hours
- **Response Time**: <500ms
- **Range**: 3 meters in typical room conditions

### Audio Quality
- **SNR**: 61dB (INMP441 specification)
- **Sample Rate**: 16kHz for voice applications
- **Latency**: Target <100ms total system latency

### Power Consumption
- **Active Listening**: 20-35mA (microphones + wake word)
- **Deep Sleep**: 10-150µA between audio activities
- **Streaming**: 150-300mA (including Wi-Fi)

## Libraries and Frameworks Comparison

### ESP-Skainet (ESP-SR)
**Pros:**
- Native ESP32-S3 support with hardware acceleration
- Complete framework (AFE + WakeNet + MultiNet)
- Free and open source
- Optimized for low power consumption (22% CPU usage)
- Amazon Alexa certified AFE algorithms

**Cons:**
- Limited to Espressif ecosystem
- Custom wake word training requires Espressif services
- Documentation primarily in Chinese

### Porcupine
**Pros:**
- Industry-leading accuracy
- Easy custom wake word creation via web console
- Cross-platform compatibility
- Professional-grade performance

**Cons:**
- Commercial licensing required for production
- Higher resource usage compared to ESP-Skainet
- External dependency

### Recommendation
- **Start with ESP-Skainet** for development and testing
- **Evaluate Porcupine** if custom wake word accuracy is insufficient
- **ESP-Skainet** likely sufficient for "Nebula" wake word implementation

## Hardware Bill of Materials

### Essential Components (Purchased)
- **XIAO ESP32S3 (3-pack)**: ~$30 (Seeed Studio) - includes 8MB PSRAM, 8MB Flash
- **INMP441 Microphones (5-pack)**: ~$15 (EC Buying) - high precision, low power
- **PAM8403 Amplifiers (5-pack)**: ~$12 (HiLetgo) - 2x3W digital amplifier
- **3W Speakers 4Ω (2-pack)**: ~$8 (Gikfun EK1725) - full range audio speakers
- **Breadboard & Jumper Wires**: ~$10
- **Total**: ~$75 (with extra components for multiple builds/spares)

### Optional Upgrades
- MAX98357A I2S Amplifier: ~$8 (replaces PAM8403)
- Second 3W Speaker: ~$8 (for stereo)
- Custom PCB (prototype): $50-100

## Next Steps

1. **Assemble breadboard prototype** with 2 INMP441 microphones
2. **Test basic I2S audio capture** and DAC output
3. **Implement ESP-Skainet framework** for wake word detection
4. **Develop WebSocket communication** for audio streaming
5. **Integrate complete audio pipeline** with AFE processing
6. **Optimize for performance and power consumption**

## Success Criteria

### Minimum Viable Product
- [ ] "Nebula" wake word detection functional
- [ ] Bidirectional audio streaming via WebSocket
- [ ] 3-meter wake word detection range
- [ ] Audible speaker output for responses

### Production Ready
- [ ] <500ms wake word response time
- [ ] >95% wake word detection accuracy
- [ ] Stable WebSocket connectivity with reconnection
- [ ] Optimized power consumption for battery operation 