#!/bin/bash
# Start Azurite (Azure Storage Emulator)
# This script starts Azurite for local Azure Storage development

echo -e "\033[0;36mStarting Azurite (Azure Storage Emulator)...\033[0m"
echo -e "\033[0;33mPress Ctrl+C to stop\033[0m"
echo ""

# Create azurite directory if it doesn't exist
AZURITE_DIR="$HOME/.azurite"
if [ ! -d "$AZURITE_DIR" ]; then
    echo -e "\033[0;33mCreating Azurite data directory: $AZURITE_DIR\033[0m"
    mkdir -p "$AZURITE_DIR"
fi

# Start Azurite
echo -e "\033[0;32mAzurite endpoints:\033[0m"
echo -e "\033[0;37m  Tables: http://127.0.0.1:10002\033[0m"
echo -e "\033[0;37m  Blobs:  http://127.0.0.1:10000\033[0m"
echo -e "\033[0;37m  Queues: http://127.0.0.1:10001\033[0m"
echo ""

azurite --silent --location "$AZURITE_DIR" --debug "$AZURITE_DIR/debug.log"

# Made with Bob
