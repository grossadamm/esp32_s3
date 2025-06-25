# Phase 1: Minimal Hardware Setup

## Objectives
- [ ] Assemble hardware on breadboard
- [ ] Test I2S microphone input
- [ ] Test direct DAC audio output  
- [ ] Basic audio loopback test (mic → speaker passthrough)
- [ ] Verify hardware connections work reliably
- [ ] Add basic memory monitoring
- [ ] Implement basic audio buffering

## Required Components
- XIAO ESP32S3
- 2x INMP441 MEMS Microphones
- 1x 3W Speaker (4Ω) 
- Breadboard & Jumper Wires
- USB-C Power Supply

## Wiring Connections

### INMP441 Microphone 1 (Left Channel)
```
INMP441 Pin → XIAO ESP32S3 Pin → Function
VDD         → 3V3              → Power supply
GND         → GND              → Ground
SD          → GPIO1 (A0)       → Serial Data (I2S)
SCK         → GPIO2 (A1)       → Serial Clock (I2S)
WS          → GPIO3 (A2)       → Word Select (I2S)
L/R         → GND              → Left channel select
```

### INMP441 Microphone 2 (Right Channel)
```
INMP441 Pin → XIAO ESP32S3 Pin → Function
VDD         → 3V3              → Power supply
GND         → GND              → Ground
SD          → GPIO1 (A0)       → Serial Data (shared)
SCK         → GPIO2 (A1)       → Serial Clock (shared)
WS          → GPIO3 (A2)       → Word Select (shared)
L/R         → 3V3              → Right channel select
```

### Direct Speaker Connection
```
Speaker Wire → XIAO ESP32S3 Pin → Function
Positive (+) → GPIO44 (DAC2)    → Audio output
Negative (-) → GND              → Ground reference
```

## Physical Layout
- Microphone spacing: 4-6cm apart
- Orientation: Horizontal line, parallel placement
- Both microphones facing same direction
- Keep speaker wires short to minimize noise

## Audio Specifications
- Sample Rate: 16kHz
- Bit Depth: 16-bit
- Channels: Stereo input, Mono output
- Expected output: 50-80mW (very quiet volume)

## Testing Sequence

### Test 1: Power Verification
1. Connect USB-C power to XIAO ESP32S3
2. Verify 3.3V output on 3V3 pin
3. Check all ground connections

### Test 2: Microphone Input
1. Upload basic I2S input code
2. Verify audio data from both microphones
3. Check left/right channel separation

### Test 3: Direct DAC Output
1. Generate simple tone on GPIO44 (DAC2)
2. Connect speaker to GPIO44 and GND
3. Expect very quiet output (normal for direct DAC)
4. Test different DAC voltage levels

### Test 4: Audio Loopback
1. Implement mic → DAC passthrough
2. Speak loudly into microphones
3. Listen for quiet audio from speaker
4. Verify basic functionality

## Software Architecture
```c
void app_main() {
    init_hardware();
    init_memory_monitoring();
    init_audio_buffers();
    while(1) {
        simple_audio_loop();  // mic → speaker passthrough
        log_memory_usage();
        vTaskDelay(10);
    }
}
```

## Success Criteria
- [ ] Both microphones capturing audio data
- [ ] Audio output through speaker (even if quiet)
- [ ] Stable power delivery
- [ ] Basic memory management working
- [ ] Audio loopback functioning

## Notes
- Volume will be very quiet without amplifier
- This setup is for testing functionality only
- Ready to upgrade to PAM8403 amplifier when available 