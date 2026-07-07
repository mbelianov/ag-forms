#!/bin/bash
# Start Azure Functions Runtime
# This script starts the Azure Functions local development server

echo -e "\033[0;36mStarting Azure Functions Runtime...\033[0m"
echo -e "\033[0;33mPress Ctrl+C to stop\033[0m"
echo ""

# Check if api directory exists
if [ ! -d "api" ]; then
    echo -e "\033[0;31mError: 'api' directory not found!\033[0m"
    echo -e "\033[0;33mPlease run setup-dev-environment.sh first\033[0m"
    exit 1
fi

# Check if Azurite is running
echo -e "\033[0;33mChecking if Azurite is running...\033[0m"
AZURITE_RUNNING=false
if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:10002 2>/dev/null | grep -q "200\|400"; then
    AZURITE_RUNNING=true
fi

if [ "$AZURITE_RUNNING" = false ]; then
    echo -e "\033[0;33m⚠ Warning: Azurite does not appear to be running\033[0m"
    echo -e "\033[0;33m  Please start Azurite in a separate terminal:\033[0m"
    echo -e "\033[0;36m  ./start-azurite.sh\033[0m"
    echo ""
    echo -e "\033[0;33mContinuing anyway...\033[0m"
    echo ""
fi

# Change to api directory and start functions
cd api || exit 1

echo -e "\033[0;32mAzure Functions will be available at:\033[0m"
echo -e "\033[0;37m  http://localhost:7071\033[0m"
echo ""
echo -e "\033[0;32mCORS enabled for: http://localhost:3000, http://localhost:5173\033[0m"
echo ""

func start --cors "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173"

# Made with Bob
