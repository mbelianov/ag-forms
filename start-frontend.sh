#!/bin/bash
# Start Frontend Development Server
# This script starts the Vite development server for the AG Forms frontend

echo -e "\033[0;32mStarting AG Forms Frontend...\033[0m"
echo -e "\033[0;36mServer will be available at: http://127.0.0.1:3000\033[0m"
echo -e "\033[0;36mAPI requests will be proxied to: http://localhost:7071\033[0m"
echo ""
echo -e "\033[0;33mPress Ctrl+C to stop the server\033[0m"
echo ""

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Change to frontend directory and start dev server
cd "$SCRIPT_DIR/frontend" || exit 1
npm run dev

# Made with Bob
