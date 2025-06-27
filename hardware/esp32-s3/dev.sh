#!/bin/bash
# ESP32-S3 Development Environment Manager

CONTAINER_NAME="esp32-dev-persistent"

case "$1" in
    "start")
        echo "Starting persistent ESP-IDF container..."
        docker-compose up -d esp32-dev
        docker exec -it $CONTAINER_NAME bash
        ;;
    "exec"|"shell")
        echo "Connecting to running container..."
        docker exec -it $CONTAINER_NAME bash
        ;;
    "build")
        echo "Building project..."
        docker exec -it $CONTAINER_NAME bash -c ". /opt/esp/idf/export.sh && idf.py build"
        ;;
    "flash")
        echo "Flashing device..."
        docker exec -it $CONTAINER_NAME bash -c ". /opt/esp/idf/export.sh && idf.py flash"
        ;;
    "monitor")
        echo "Starting serial monitor..."
        docker exec -it $CONTAINER_NAME bash -c ". /opt/esp/idf/export.sh && idf.py monitor"
        ;;
    "flash-monitor")
        echo "Flash and monitor..."
        docker exec -it $CONTAINER_NAME bash -c ". /opt/esp/idf/export.sh && idf.py flash monitor"
        ;;
    "stop")
        echo "Stopping container..."
        docker-compose down
        ;;
    "status")
        echo "Container status:"
        docker ps | grep $CONTAINER_NAME
        ;;
    *)
        echo "ESP32-S3 Development Commands:"
        echo "  ./dev.sh start         # Start container and open shell"
        echo "  ./dev.sh exec          # Connect to running container"
        echo "  ./dev.sh build         # Build project"
        echo "  ./dev.sh flash         # Flash to device"
        echo "  ./dev.sh monitor       # Serial monitor"
        echo "  ./dev.sh flash-monitor # Flash and monitor"
        echo "  ./dev.sh stop          # Stop container"
        echo "  ./dev.sh status        # Check if running"
        ;;
esac 