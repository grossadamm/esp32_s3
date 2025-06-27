idf_component_register(SRCS "phase1_audio_test.c"
                    INCLUDE_DIRS "."
                    REQUIRES driver esp_wifi esp_event esp_netif nvs_flash)
