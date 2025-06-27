#include "driver/i2s_std.h"
#include "driver/ledc.h"
#include "esp_heap_caps.h"
#include "esp_log.h"
#include "esp_system.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// WebSocket and WiFi includes
#include "esp_event.h"
#include "esp_netif.h"
#include "esp_websocket_client.h"
#include "esp_wifi.h"
#include "nvs_flash.h"

static const char *TAG = "PHASE1_AUDIO_WS";

// WiFi Configuration - UPDATE THESE
#define WIFI_SSID "exterminate"
#define WIFI_PASSWORD "hurricane"

// WebSocket Configuration - UPDATE THIS
#define WEBSOCKET_URI "ws://192.168.1.108:3000/api/audio/realtime"

// Audio Configuration
#define SAMPLE_RATE 16000
#define I2S_BCK_IO (GPIO_NUM_7)       // Serial Clock (try different pins)
#define I2S_WS_IO (GPIO_NUM_8)        // Word Select (try different pins)
#define I2S_DI_IO (GPIO_NUM_9)        // Serial Data (try different pins)
#define AUDIO_OUTPUT_IO (GPIO_NUM_44) // PWM audio output

// Buffer Configuration
#define DMA_BUF_COUNT 8
#define DMA_BUF_LEN 512
#define AUDIO_BUFFER_SIZE 1024

// PWM Configuration for audio
#define PWM_TIMER LEDC_TIMER_0
#define PWM_MODE LEDC_LOW_SPEED_MODE
#define PWM_CHANNEL LEDC_CHANNEL_0
#define PWM_FREQUENCY (SAMPLE_RATE * 2) // PWM frequency
#define PWM_RESOLUTION LEDC_TIMER_8_BIT

// Global handles and buffers
static i2s_chan_handle_t rx_handle = NULL;
static int32_t *audio_input_buffer = NULL; // 32-bit for INMP441
static uint8_t *pwm_output_buffer = NULL;

// Simplified networking state
static esp_websocket_client_handle_t websocket_client = NULL;
static bool can_stream_audio = false; // Only flag we need

// Memory monitoring
static size_t last_free_heap = 0;
static size_t min_free_heap = SIZE_MAX;

// Function declarations
void handle_incoming_audio(uint8_t *audio_data, size_t len);
void handle_incoming_text(char *text_data, size_t len);

// Simplified event handlers
static void websocket_event_handler(void *handler_args, esp_event_base_t base,
                                    int32_t event_id, void *event_data) {
  esp_websocket_event_data_t *data = (esp_websocket_event_data_t *)event_data;

  switch (event_id) {
  case WEBSOCKET_EVENT_CONNECTED:
    ESP_LOGI(TAG, "🔗 WebSocket connected");
    can_stream_audio = true;
    break;
  case WEBSOCKET_EVENT_DISCONNECTED:
  case WEBSOCKET_EVENT_ERROR:
    ESP_LOGI(TAG, "💔 WebSocket disconnected");
    can_stream_audio = false;
    break;
  case WEBSOCKET_EVENT_DATA:
    if (data->op_code == 0x02) { // Binary data (audio)
      ESP_LOGI(TAG, "📨 Received %d bytes of audio", data->data_len);
      handle_incoming_audio((uint8_t *)data->data_ptr, data->data_len);
    } else if (data->op_code == 0x01) { // Text data
      ESP_LOGI(TAG, "📨 Received text: %.*s", data->data_len,
               (char *)data->data_ptr);
      handle_incoming_text((char *)data->data_ptr, data->data_len);
    }
    break;
  default:
    break;
  }
}

static void wifi_event_handler(void *arg, esp_event_base_t event_base,
                               int32_t event_id, void *event_data) {
  if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
    esp_wifi_connect();
  } else if (event_base == WIFI_EVENT &&
             event_id == WIFI_EVENT_STA_DISCONNECTED) {
    can_stream_audio = false;
    esp_wifi_connect();
  } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
    ESP_LOGI(TAG, "🌐 WiFi connected");
    esp_websocket_client_start(websocket_client);
  }
}

// Single networking initialization function
esp_err_t init_networking(void) {
  // NVS
  esp_err_t ret = nvs_flash_init();
  if (ret == ESP_ERR_NVS_NO_FREE_PAGES ||
      ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
    ESP_ERROR_CHECK(nvs_flash_erase());
    ret = nvs_flash_init();
  }
  ESP_ERROR_CHECK(ret);

  // WiFi
  ESP_ERROR_CHECK(esp_netif_init());
  ESP_ERROR_CHECK(esp_event_loop_create_default());
  esp_netif_create_default_wifi_sta();

  wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
  ESP_ERROR_CHECK(esp_wifi_init(&cfg));

  ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID,
                                             &wifi_event_handler, NULL));
  ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP,
                                             &wifi_event_handler, NULL));

  wifi_config_t wifi_config = {
      .sta =
          {
              .ssid = WIFI_SSID,
              .password = WIFI_PASSWORD,
              .threshold.authmode = WIFI_AUTH_WPA2_PSK,
          },
  };
  ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
  ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
  ESP_ERROR_CHECK(esp_wifi_start());

  // WebSocket
  esp_websocket_client_config_t websocket_cfg = {.uri = WEBSOCKET_URI};
  websocket_client = esp_websocket_client_init(&websocket_cfg);
  esp_websocket_register_events(websocket_client, WEBSOCKET_EVENT_ANY,
                                websocket_event_handler, NULL);

  ESP_LOGI(TAG, "🔌 Connecting to %s...", WIFI_SSID);
  return ESP_OK;
}

// Single function to handle audio streaming
void stream_audio_if_connected(uint8_t *audio_data, size_t len) {
  if (can_stream_audio) {
    esp_websocket_client_send_bin(websocket_client, (char *)audio_data, len, 0);
  }
}

// Handle incoming audio data from server
void handle_incoming_audio(uint8_t *audio_data, size_t len) {
  ESP_LOGI(TAG, "🔊 Playing %d bytes of received audio", len);

  // Play received audio through PWM speaker
  for (int i = 0; i < len && i < AUDIO_BUFFER_SIZE; i++) {
    uint32_t duty = (uint32_t)audio_data[i];
    ledc_set_duty(PWM_MODE, PWM_CHANNEL, duty);
    ledc_update_duty(PWM_MODE, PWM_CHANNEL);

    // Simple timing - matches our sample rate
    vTaskDelay(pdMS_TO_TICKS(1000 / SAMPLE_RATE));
  }
}

// Handle incoming text commands/messages from server
void handle_incoming_text(char *text_data, size_t len) {
  // Simple command processing
  if (strncmp(text_data, "mute", 4) == 0) {
    ESP_LOGI(TAG, "🔇 Mute command received");
    can_stream_audio = false;
  } else if (strncmp(text_data, "unmute", 6) == 0) {
    ESP_LOGI(TAG, "🔊 Unmute command received");
    can_stream_audio = true;
  } else if (strncmp(text_data, "status", 6) == 0) {
    ESP_LOGI(TAG, "📊 Status requested - streaming: %s",
             can_stream_audio ? "ON" : "OFF");
    // Send status back to server
    char status_msg[64];
    snprintf(status_msg, sizeof(status_msg), "status:streaming=%s",
             can_stream_audio ? "ON" : "OFF");
    esp_websocket_client_send_text(websocket_client, status_msg,
                                   strlen(status_msg), portMAX_DELAY);
  } else {
    ESP_LOGI(TAG, "📝 Unknown text command: %.*s", len, text_data);
  }
}

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
  audio_input_buffer = (int32_t *)heap_caps_malloc(
      AUDIO_BUFFER_SIZE * sizeof(int32_t), MALLOC_CAP_DMA);
  if (!audio_input_buffer) {
    ESP_LOGE(TAG, "Failed to allocate input buffer");
    return ESP_ERR_NO_MEM;
  }

  // Allocate PWM output buffer (8-bit unsigned)
  pwm_output_buffer =
      (uint8_t *)heap_caps_malloc(AUDIO_BUFFER_SIZE, MALLOC_CAP_DMA);
  if (!pwm_output_buffer) {
    ESP_LOGE(TAG, "Failed to allocate PWM buffer");
    free(audio_input_buffer);
    return ESP_ERR_NO_MEM;
  }

  ESP_LOGI(TAG, "Audio buffers allocated successfully");
  return ESP_OK;
}

esp_err_t init_i2s_input(void) {
  ESP_LOGI(TAG, "🔧 INMP441 Power-up delay...");
  vTaskDelay(pdMS_TO_TICKS(100)); // INMP441 needs 10ms+ startup time

  // I2S channel configuration
  i2s_chan_config_t chan_cfg =
      I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_AUTO, I2S_ROLE_MASTER);
  chan_cfg.dma_desc_num = DMA_BUF_COUNT;
  chan_cfg.dma_frame_num = DMA_BUF_LEN;

  esp_err_t ret = i2s_new_channel(&chan_cfg, NULL, &rx_handle);
  if (ret != ESP_OK) {
    ESP_LOGE(TAG, "Failed to create I2S channel: %s", esp_err_to_name(ret));
    return ret;
  }

  // I2S standard configuration - INMP441 requires 32-bit format
  i2s_std_config_t std_cfg = {
      .clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(SAMPLE_RATE),
      .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_32BIT,
                                                      I2S_SLOT_MODE_STEREO),
      .gpio_cfg =
          {
              .mclk = I2S_GPIO_UNUSED,
              .bclk = I2S_BCK_IO,
              .ws = I2S_WS_IO,
              .dout = I2S_GPIO_UNUSED,
              .din = I2S_DI_IO,
              .invert_flags =
                  {
                      .mclk_inv = false,
                      .bclk_inv = false,
                      .ws_inv = false,
                  },
          },
  };

  ret = i2s_channel_init_std_mode(rx_handle, &std_cfg);
  if (ret != ESP_OK) {
    ESP_LOGE(TAG, "Failed to initialize I2S standard mode: %s",
             esp_err_to_name(ret));
    return ret;
  }

  ret = i2s_channel_enable(rx_handle);
  if (ret != ESP_OK) {
    ESP_LOGE(TAG, "Failed to enable I2S channel: %s", esp_err_to_name(ret));
    return ret;
  }

  ESP_LOGI(TAG, "I2S input initialized - Pins: BCK=%d, WS=%d, DI=%d",
           I2S_BCK_IO, I2S_WS_IO, I2S_DI_IO);

  // Verify I2S clock is running by checking if we get timeout errors
  ESP_LOGI(TAG, "🔍 Testing I2S communication...");
  size_t test_bytes = 0;
  ret = i2s_channel_read(rx_handle, audio_input_buffer, 64, &test_bytes,
                         pdMS_TO_TICKS(100));
  if (ret == ESP_ERR_TIMEOUT) {
    ESP_LOGE(TAG, "❌ I2S TIMEOUT - Clock not running or no device responding");
  } else if (ret == ESP_OK) {
    ESP_LOGI(TAG, "✅ I2S responding - Read %d bytes", test_bytes);
  } else {
    ESP_LOGE(TAG, "❌ I2S Error: %s", esp_err_to_name(ret));
  }

  return ESP_OK;
}

esp_err_t init_pwm_output(void) {
  // Configure PWM timer
  ledc_timer_config_t timer_config = {.speed_mode = PWM_MODE,
                                      .timer_num = PWM_TIMER,
                                      .duty_resolution = PWM_RESOLUTION,
                                      .freq_hz = PWM_FREQUENCY,
                                      .clk_cfg = LEDC_AUTO_CLK};

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
      .hpoint = 0};

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
void process_audio_data(int32_t *input, uint8_t *output, size_t samples) {
  for (size_t i = 0; i < samples; i += 2) { // Process stereo pairs
    // Mix left and right channels
    int32_t left = input[i];
    int32_t right = input[i + 1];
    int32_t mixed = (left + right) / 2;

    // Convert from signed 32-bit to unsigned 8-bit (0 to 255)
    // For INMP441: 32-bit data is actually 24-bit left-aligned, so we need
    // bigger scaling
    mixed = (mixed >> 16) + 128; // Scale from 32-bit range to 8-bit range

    // Clamp to valid PWM range
    if (mixed < 0)
      mixed = 0;
    if (mixed > 255)
      mixed = 255;

    output[i / 2] = (uint8_t)mixed;
  }
}

void simple_audio_loop(void) {
  size_t bytes_read = 0;

  // Read stereo audio data from I2S
  esp_err_t ret = i2s_channel_read(rx_handle, audio_input_buffer,
                                   AUDIO_BUFFER_SIZE * sizeof(int32_t),
                                   &bytes_read, portMAX_DELAY);

  if (ret != ESP_OK) {
    ESP_LOGW(TAG, "I2S read error: %s", esp_err_to_name(ret));
    return;
  }

  // LOG EVERYTHING - Debug I2S data reception
  static uint32_t total_reads = 0;
  total_reads++;

  if (bytes_read > 0) {
    ESP_LOGI(TAG, "📡 I2S READ #%u: %d bytes, %d samples",
             (unsigned int)total_reads, (int)bytes_read,
             (int)(bytes_read / sizeof(int16_t)));

    // Show first few raw samples from microphones
    if (bytes_read >= 8) { // At least 4 int16_t samples
      ESP_LOGI(TAG, "📊 Raw samples: L0=%d, R0=%d, L1=%d, R1=%d",
               (int)audio_input_buffer[0], (int)audio_input_buffer[1],
               (int)audio_input_buffer[2], (int)audio_input_buffer[3]);
    }
  } else {
    ESP_LOGW(TAG, "⚠️  I2S read returned 0 bytes!");
    return;
  }

  if (bytes_read > 0) {
    size_t samples_read = bytes_read / sizeof(int32_t);

    // Process audio: stereo → mono, 16-bit → 8-bit
    process_audio_data(audio_input_buffer, pwm_output_buffer, samples_read);

    // Output to PWM (speaker) - simple approach: just use first processed
    // sample
    if (samples_read > 0) {
      uint32_t duty = (uint32_t)pwm_output_buffer[0];
      ledc_set_duty(PWM_MODE, PWM_CHANNEL, duty);
      ledc_update_duty(PWM_MODE, PWM_CHANNEL);
    }

    // WebSocket: Send raw audio data if connected
    if (can_stream_audio) {
      // Send raw 32-bit audio instead of processed 8-bit PWM
      stream_audio_if_connected((uint8_t *)audio_input_buffer, bytes_read);
    }

    // Fast audio level monitoring for testing
    static uint32_t last_log_time = 0;
    uint32_t current_time = xTaskGetTickCount() * portTICK_PERIOD_MS;

    // Log every 500ms for faster feedback during testing
    if (current_time - last_log_time > 500) {
      // Calculate average audio level for better detection
      uint32_t audio_sum = 0;
      uint32_t min_level = 255;
      uint32_t max_level = 0;

      for (int i = 0; i < samples_read / 2; i++) {
        uint8_t level = pwm_output_buffer[i];
        audio_sum += level;
        if (level < min_level)
          min_level = level;
        if (level > max_level)
          max_level = level;
      }

      uint32_t avg_level = audio_sum / (samples_read / 2);
      uint32_t audio_range = max_level - min_level;

      // More detailed logging
      if (audio_range > 5) { // Audio activity detected
        ESP_LOGI(TAG,
                 "🎤 AUDIO DETECTED! Avg: %u, Range: %u (min: %u, max: "
                 "%u), PWM: %d",
                 (unsigned int)avg_level, (unsigned int)audio_range,
                 (unsigned int)min_level, (unsigned int)max_level,
                 pwm_output_buffer[0]);
      } else {
        ESP_LOGI(TAG, "🔇 Silent - Avg: %u, Range: %u, PWM: %d (samples: %d)",
                 (unsigned int)avg_level, (unsigned int)audio_range,
                 pwm_output_buffer[0], (int)samples_read);
      }

      last_log_time = current_time;
    }

    // Immediate feedback for loud audio
    uint32_t current_duty = pwm_output_buffer[0];
    if (current_duty < 100 ||
        current_duty > 156) { // Significant deviation from 128
      ESP_LOGI(TAG, "📢 LOUD AUDIO! PWM duty: %u", (unsigned int)current_duty);
    }
  }
}

void app_main(void) {
  ESP_LOGI(TAG, "=== ESP32-S3 Phase 1 + WebSocket Audio Test Starting ===");
  ESP_LOGI(TAG, "Hardware: XIAO ESP32S3 + 2x INMP441 + PWM Speaker Output");
  ESP_LOGI(TAG, "Configuration: %dHz, 16-bit, Stereo Input → Mono PWM Output",
           SAMPLE_RATE);
  ESP_LOGI(TAG, "Audio output: GPIO%d (PWM)", AUDIO_OUTPUT_IO);

  // Initialize components
  init_memory_monitoring();

  // Initialize networking (WiFi + WebSocket)
  ESP_LOGI(TAG, "🌐 Initializing networking...");
  esp_err_t ret = init_networking();
  if (ret != ESP_OK) {
    ESP_LOGE(TAG, "Failed to initialize networking: %s", esp_err_to_name(ret));
    return;
  }

  ret = init_audio_buffers();
  if (ret != ESP_OK) {
    ESP_LOGE(TAG, "Failed to initialize audio buffers");
    return;
  }

  ret = init_hardware();
  if (ret != ESP_OK) {
    ESP_LOGE(TAG, "Failed to initialize hardware");
    return;
  }

  ESP_LOGI(TAG, "=== Phase 1 + WebSocket Audio Test Ready ===");
  ESP_LOGI(TAG, "Expected behavior:");
  ESP_LOGI(TAG, "- Device will connect to WiFi: %s", WIFI_SSID);
  ESP_LOGI(TAG, "- WebSocket will connect to: %s", WEBSOCKET_URI);
  ESP_LOGI(TAG, "- Speak loudly into microphones");
  ESP_LOGI(TAG, "- Audio data will stream over WebSocket when connected");
  ESP_LOGI(TAG, "- PWM signal will vary based on audio input");
  ESP_LOGI(TAG, "- Connect speaker/oscilloscope to GPIO%d to observe",
           AUDIO_OUTPUT_IO);
  ESP_LOGI(TAG, "- Check serial monitor for connection and activity logs");

  // Main audio processing + networking loop
  while (1) {
    simple_audio_loop(); // mic → PWM speaker passthrough + WebSocket streaming
    log_memory_usage();
    vTaskDelay(pdMS_TO_TICKS(1)); // Small delay for task scheduling
  }
}
