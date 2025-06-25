#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/i2s_std.h"
#include "driver/ledc.h"
#include "esp_system.h"
#include "esp_log.h"
#include "esp_heap_caps.h"

static const char *TAG = "PHASE1_AUDIO";

// Audio Configuration
#define SAMPLE_RATE         16000
#define I2S_BCK_IO          (GPIO_NUM_2)    // A1 - Serial Clock
#define I2S_WS_IO           (GPIO_NUM_3)    // A2 - Word Select  
#define I2S_DI_IO           (GPIO_NUM_1)    // A0 - Serial Data
#define AUDIO_OUTPUT_IO     (GPIO_NUM_44)   // PWM audio output

// Buffer Configuration
#define DMA_BUF_COUNT       8
#define DMA_BUF_LEN         512
#define AUDIO_BUFFER_SIZE   1024

// PWM Configuration for audio
#define PWM_TIMER           LEDC_TIMER_0
#define PWM_MODE            LEDC_LOW_SPEED_MODE
#define PWM_CHANNEL         LEDC_CHANNEL_0
#define PWM_FREQUENCY       (SAMPLE_RATE * 2)  // PWM frequency
#define PWM_RESOLUTION      LEDC_TIMER_8_BIT

// Global handles and buffers
static i2s_chan_handle_t rx_handle = NULL;
static int16_t *audio_input_buffer = NULL;
static uint8_t *pwm_output_buffer = NULL;

// Memory monitoring
static size_t last_free_heap = 0;
static size_t min_free_heap = SIZE_MAX;

void init_memory_monitoring(void) {
    last_free_heap = esp_get_free_heap_size();
    min_free_heap = last_free_heap;
    ESP_LOGI(TAG, "Initial free heap: %d bytes", last_free_heap);
}

void log_memory_usage(void) {
    size_t current_free = esp_get_free_heap_size();
    if (current_free < min_free_heap) {
        min_free_heap = current_free;
    }
    
    if (abs((int)(current_free - last_free_heap)) > 1024) {
        ESP_LOGI(TAG, "Heap: %d bytes free (min: %d)", current_free, min_free_heap);
        last_free_heap = current_free;
    }
}

esp_err_t init_audio_buffers(void) {
    // Allocate input buffer for stereo 16-bit samples
    audio_input_buffer = (int16_t *)heap_caps_malloc(AUDIO_BUFFER_SIZE * sizeof(int16_t), MALLOC_CAP_DMA);
    if (!audio_input_buffer) {
        ESP_LOGE(TAG, "Failed to allocate input buffer");
        return ESP_ERR_NO_MEM;
    }
    
    // Allocate PWM output buffer (8-bit unsigned)
    pwm_output_buffer = (uint8_t *)heap_caps_malloc(AUDIO_BUFFER_SIZE, MALLOC_CAP_DMA);
    if (!pwm_output_buffer) {
        ESP_LOGE(TAG, "Failed to allocate PWM buffer");
        free(audio_input_buffer);
        return ESP_ERR_NO_MEM;
    }
    
    ESP_LOGI(TAG, "Audio buffers allocated successfully");
    return ESP_OK;
}

esp_err_t init_i2s_input(void) {
    // I2S channel configuration
    i2s_chan_config_t chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_AUTO, I2S_ROLE_MASTER);
    chan_cfg.dma_desc_num = DMA_BUF_COUNT;
    chan_cfg.dma_frame_num = DMA_BUF_LEN;
    
    esp_err_t ret = i2s_new_channel(&chan_cfg, NULL, &rx_handle);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to create I2S channel: %s", esp_err_to_name(ret));
        return ret;
    }
    
    // I2S standard configuration
    i2s_std_config_t std_cfg = {
        .clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(SAMPLE_RATE),
        .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_STEREO),
        .gpio_cfg = {
            .mclk = I2S_GPIO_UNUSED,
            .bclk = I2S_BCK_IO,
            .ws = I2S_WS_IO,
            .dout = I2S_GPIO_UNUSED,
            .din = I2S_DI_IO,
            .invert_flags = {
                .mclk_inv = false,
                .bclk_inv = false,
                .ws_inv = false,
            },
        },
    };
    
    ret = i2s_channel_init_std_mode(rx_handle, &std_cfg);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize I2S standard mode: %s", esp_err_to_name(ret));
        return ret;
    }
    
    ret = i2s_channel_enable(rx_handle);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to enable I2S channel: %s", esp_err_to_name(ret));
        return ret;
    }
    
    ESP_LOGI(TAG, "I2S input initialized - Pins: BCK=%d, WS=%d, DI=%d", 
             I2S_BCK_IO, I2S_WS_IO, I2S_DI_IO);
    return ESP_OK;
}

esp_err_t init_pwm_output(void) {
    // Configure PWM timer
    ledc_timer_config_t timer_config = {
        .speed_mode = PWM_MODE,
        .timer_num = PWM_TIMER,
        .duty_resolution = PWM_RESOLUTION,
        .freq_hz = PWM_FREQUENCY,
        .clk_cfg = LEDC_AUTO_CLK
    };
    
    esp_err_t ret = ledc_timer_config(&timer_config);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to configure PWM timer: %s", esp_err_to_name(ret));
        return ret;
    }
    
    // Configure PWM channel
    ledc_channel_config_t channel_config = {
        .speed_mode = PWM_MODE,
        .channel = PWM_CHANNEL,
        .timer_sel = PWM_TIMER,
        .intr_type = LEDC_INTR_DISABLE,
        .gpio_num = AUDIO_OUTPUT_IO,
        .duty = 128, // 50% duty cycle (middle value for 8-bit)
        .hpoint = 0
    };
    
    ret = ledc_channel_config(&channel_config);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to configure PWM channel: %s", esp_err_to_name(ret));
        return ret;
    }
    
    ESP_LOGI(TAG, "PWM audio output initialized on GPIO%d", AUDIO_OUTPUT_IO);
    return ESP_OK;
}

esp_err_t init_hardware(void) {
    ESP_LOGI(TAG, "Initializing hardware for Phase 1 audio test");
    
    esp_err_t ret = init_i2s_input();
    if (ret != ESP_OK) {
        return ret;
    }
    
    ret = init_pwm_output();
    if (ret != ESP_OK) {
        return ret;
    }
    
    ESP_LOGI(TAG, "Hardware initialization complete");
    return ESP_OK;
}

// Convert 16-bit signed stereo input to 8-bit unsigned mono for PWM
void process_audio_data(int16_t *input, uint8_t *output, size_t samples) {
    for (size_t i = 0; i < samples; i += 2) {  // Process stereo pairs
        // Mix left and right channels
        int32_t left = input[i];
        int32_t right = input[i + 1];
        int32_t mixed = (left + right) / 2;
        
        // Convert from signed 16-bit (-32768 to 32767) to unsigned 8-bit (0 to 255)
        // Center around 128 (PWM midpoint)
        mixed = (mixed / 256) + 128;
        
        // Clamp to valid PWM range
        if (mixed < 0) mixed = 0;
        if (mixed > 255) mixed = 255;
        
        output[i/2] = (uint8_t)mixed;
    }
}

void simple_audio_loop(void) {
    size_t bytes_read = 0;
    
    // Read stereo audio data from I2S
    esp_err_t ret = i2s_channel_read(rx_handle, audio_input_buffer, 
                                   AUDIO_BUFFER_SIZE * sizeof(int16_t), 
                                   &bytes_read, portMAX_DELAY);
    
    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "I2S read error: %s", esp_err_to_name(ret));
        return;
    }
    
    if (bytes_read > 0) {
        size_t samples_read = bytes_read / sizeof(int16_t);
        
        // Process audio: stereo → mono, 16-bit → 8-bit
        process_audio_data(audio_input_buffer, pwm_output_buffer, samples_read);
        
        // Output to PWM (speaker) - simple approach: just use first processed sample
        if (samples_read > 0) {
            uint32_t duty = (uint32_t)pwm_output_buffer[0];
            ledc_set_duty(PWM_MODE, PWM_CHANNEL, duty);
            ledc_update_duty(PWM_MODE, PWM_CHANNEL);
        }
        
        // Periodic status logging
        static int loop_count = 0;
        if (++loop_count % 1000 == 0) {
            ESP_LOGI(TAG, "Audio loop active - processed %d samples, PWM duty: %d", 
                     samples_read, pwm_output_buffer[0]);
        }
    }
}

void app_main(void) {
    ESP_LOGI(TAG, "=== ESP32-S3 Phase 1 Audio Test Starting ===");
    ESP_LOGI(TAG, "Hardware: XIAO ESP32S3 + 2x INMP441 + PWM Speaker Output");
    ESP_LOGI(TAG, "Configuration: %dHz, 16-bit, Stereo Input → Mono PWM Output", SAMPLE_RATE);
    ESP_LOGI(TAG, "Audio output: GPIO%d (PWM)", AUDIO_OUTPUT_IO);
    
    // Initialize components
    init_memory_monitoring();
    
    esp_err_t ret = init_audio_buffers();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize audio buffers");
        return;
    }
    
    ret = init_hardware();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize hardware");
        return;
    }
    
    ESP_LOGI(TAG, "=== Phase 1 Audio Test Ready ===");
    ESP_LOGI(TAG, "Expected behavior:");
    ESP_LOGI(TAG, "- Speak loudly into microphones");
    ESP_LOGI(TAG, "- PWM signal will vary based on audio input");
    ESP_LOGI(TAG, "- Connect speaker/oscilloscope to GPIO%d to observe", AUDIO_OUTPUT_IO);
    ESP_LOGI(TAG, "- Check serial monitor for activity logs");
    
    // Main audio processing loop
    while(1) {
        simple_audio_loop();  // mic → PWM speaker passthrough
        log_memory_usage();
        vTaskDelay(pdMS_TO_TICKS(1));  // Small delay for task scheduling
    }
}
