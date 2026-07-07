#!/bin/bash
# Azure Functions Local Development Environment Setup Script
# This script automates the setup process for local Azure Functions development

set -e  # Exit on error

echo "========================================"
echo "Azure Functions Dev Environment Setup"
echo "========================================"
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Step 1: Check Node.js
echo "Step 1: Checking Node.js installation..."
if command_exists node; then
    NODE_VERSION=$(node --version)
    echo -e "\033[0;32m[OK] Node.js is installed: $NODE_VERSION\033[0m"
    
    # Check if version is 20.x or higher
    VERSION_NUMBER=$(echo "$NODE_VERSION" | sed 's/v\([0-9]*\).*/\1/')
    if [ "$VERSION_NUMBER" -lt 20 ]; then
        echo -e "\033[0;33m[WARN] Node.js 20.x LTS or higher is recommended for Azure Functions v4\033[0m"
        echo -e "\033[0;33m  Current version: $NODE_VERSION\033[0m"
    fi
else
    echo -e "\033[0;31m[ERROR] Node.js is not installed\033[0m"
    echo -e "\033[0;31m  Please install Node.js 20.x LTS from: https://nodejs.org/\033[0m"
    exit 1
fi

# Step 2: Check npm
echo ""
echo "Step 2: Checking npm installation..."
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    echo -e "\033[0;32m[OK] npm is installed: $NPM_VERSION\033[0m"
else
    echo -e "\033[0;31m[ERROR] npm is not installed\033[0m"
    exit 1
fi

# Step 3: Install Azure Functions Core Tools
echo ""
echo "Step 3: Checking Azure Functions Core Tools..."
if command_exists func; then
    FUNC_VERSION=$(func --version)
    echo -e "\033[0;32m[OK] Azure Functions Core Tools is installed: $FUNC_VERSION\033[0m"
else
    echo -e "\033[0;33m[WARN] Azure Functions Core Tools not found. Installing...\033[0m"
    npm install -g azure-functions-core-tools@4 --unsafe-perm true
    if [ $? -eq 0 ]; then
        echo -e "\033[0;32m[OK] Azure Functions Core Tools installed successfully\033[0m"
    else
        echo -e "\033[0;31m[ERROR] Failed to install Azure Functions Core Tools\033[0m"
        echo -e "\033[0;31m  Please run manually: npm install -g azure-functions-core-tools@4 --unsafe-perm true\033[0m"
        exit 1
    fi
fi

# Step 4: Install Azurite
echo ""
echo "Step 4: Checking Azurite (Azure Storage Emulator)..."
if command_exists azurite; then
    AZURITE_VERSION=$(azurite --version 2>&1 | head -n 1)
    echo -e "\033[0;32m[OK] Azurite is installed: $AZURITE_VERSION\033[0m"
else
    echo -e "\033[0;33m[WARN] Azurite not found. Installing...\033[0m"
    npm install -g azurite
    if [ $? -eq 0 ]; then
        echo -e "\033[0;32m[OK] Azurite installed successfully\033[0m"
    else
        echo -e "\033[0;31m[ERROR] Failed to install Azurite\033[0m"
        echo -e "\033[0;31m  Please run manually: npm install -g azurite\033[0m"
        exit 1
    fi
fi

# Step 5: Install API dependencies
echo ""
echo "Step 5: Installing API dependencies..."
if [ -d "api" ]; then
    echo -e "\033[0;33m[WARN] 'api' directory already exists. Installing/updating dependencies...\033[0m"
    cd api
    echo "  Installing dependencies..."
    npm install
    cd ..
    echo -e "\033[0;32m[OK] API dependencies installed successfully\033[0m"
else
    echo -e "\033[0;31m[ERROR] 'api' directory not found!\033[0m"
    echo -e "\033[0;31m  This script expects the API project to already exist.\033[0m"
    exit 1
fi

# Step 6: Install Frontend dependencies
echo ""
echo "Step 6: Installing Frontend dependencies..."
if [ -d "frontend" ]; then
    echo -e "\033[0;33m[INFO] 'frontend' directory found. Installing/updating dependencies...\033[0m"
    cd frontend
    echo "  Installing dependencies..."
    npm install
    cd ..
    echo -e "\033[0;32m[OK] Frontend dependencies installed successfully\033[0m"
else
    echo -e "\033[0;33m[WARN] 'frontend' directory not found. Skipping frontend setup.\033[0m"
fi

# Step 7: Create local.settings.json if it doesn't exist
echo ""
echo "Step 7: Checking local.settings.json..."
LOCAL_SETTINGS_PATH="api/local.settings.json"
if [ -f "$LOCAL_SETTINGS_PATH" ]; then
    echo -e "\033[0;33m[WARN] local.settings.json already exists. Skipping.\033[0m"
else
    echo "  Creating local.settings.json..."
    cat > "$LOCAL_SETTINGS_PATH" << 'EOF'
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsFeatureFlags": "EnableWorkerIndexing",
    "AZURE_STORAGE_CONNECTION_STRING": "UseDevelopmentStorage=true",
    "NODE_ENV": "development"
  },
  "Host": {
    "LocalHttpPort": 7071,
    "CORS": "*",
    "CORSCredentials": false
  }
}
EOF
    echo -e "\033[0;32m[OK] local.settings.json created successfully\033[0m"
fi

# Step 8: Create Azurite data directory
echo ""
echo "Step 8: Creating Azurite data directory..."
AZURITE_DIR="$HOME/.azurite"
if [ -d "$AZURITE_DIR" ]; then
    echo -e "\033[0;32m[OK] Azurite directory already exists: $AZURITE_DIR\033[0m"
else
    mkdir -p "$AZURITE_DIR"
    echo -e "\033[0;32m[OK] Azurite directory created: $AZURITE_DIR\033[0m"
fi

# Summary
echo ""
echo "========================================"
echo -e "\033[0;32mSetup Complete!\033[0m"
echo "========================================"
echo ""
echo -e "\033[0;33mNext Steps:\033[0m"
echo -e "\033[0;37m1. Start Azurite in a separate terminal:\033[0m"
echo -e "\033[0;36m   ./start-azurite.sh\033[0m"
echo ""
echo -e "\033[0;37m2. Start Azure Functions in another terminal:\033[0m"
echo -e "\033[0;36m   ./start-functions.sh\033[0m"
echo ""
echo -e "\033[0;37m3. Start the frontend in a third terminal:\033[0m"
echo -e "\033[0;36m   ./start-frontend.sh\033[0m"
echo ""
echo -e "\033[0;37m4. Initialize the database:\033[0m"
echo -e "\033[0;36m   ./init-database.sh\033[0m"
echo ""
echo -e "\033[0;33mFor detailed documentation, see: docs/06-local-dev-setup.md\033[0m"
echo ""

# Made with Bob
