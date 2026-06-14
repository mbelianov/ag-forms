# Azure Functions Local Development Environment Setup Script
# This script automates the setup process for local Azure Functions development

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Azure Functions Dev Environment Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if a command exists
function Test-CommandExists {
    param($command)
    $null = Get-Command $command -ErrorAction SilentlyContinue
    return $?
}

# Step 1: Check Node.js
Write-Host "Step 1: Checking Node.js installation..." -ForegroundColor Yellow
if (Test-CommandExists "node") {
    $nodeVersion = node --version
    Write-Host "[OK] Node.js is installed: $nodeVersion" -ForegroundColor Green
    
    # Check if version is 20.x or higher
    $versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($versionNumber -lt 20) {
        Write-Host "[WARN] Node.js 20.x LTS or higher is recommended for Azure Functions v4" -ForegroundColor Yellow
        Write-Host "  Current version: $nodeVersion" -ForegroundColor Yellow
    }
} else {
    Write-Host "[ERROR] Node.js is not installed" -ForegroundColor Red
    Write-Host "  Please install Node.js 20.x LTS from: https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Step 2: Check PowerShell Execution Policy
Write-Host ""
Write-Host "Step 2: Checking PowerShell execution policy..." -ForegroundColor Yellow
$executionPolicy = Get-ExecutionPolicy -Scope CurrentUser
if ($executionPolicy -eq "Restricted" -or $executionPolicy -eq "Undefined") {
    Write-Host "[WARN] PowerShell execution policy is restrictive: $executionPolicy" -ForegroundColor Yellow
    Write-Host "  Note: Running with -ExecutionPolicy Bypass for this session" -ForegroundColor Yellow
} else {
    Write-Host "[OK] Execution policy is acceptable: $executionPolicy" -ForegroundColor Green
}

# Step 3: Install Azure Functions Core Tools
Write-Host ""
Write-Host "Step 3: Checking Azure Functions Core Tools..." -ForegroundColor Yellow
if (Test-CommandExists "func") {
    $funcVersion = func --version
    Write-Host "[OK] Azure Functions Core Tools is installed: $funcVersion" -ForegroundColor Green
} else {
    Write-Host "[WARN] Azure Functions Core Tools not found. Installing..." -ForegroundColor Yellow
    try {
        npm install -g azure-functions-core-tools@4 --unsafe-perm true
        Write-Host "[OK] Azure Functions Core Tools installed successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "[ERROR] Failed to install Azure Functions Core Tools" -ForegroundColor Red
        Write-Host "  Please run manually: npm install -g azure-functions-core-tools@4 --unsafe-perm true" -ForegroundColor Red
        exit 1
    }
}

# Step 4: Install Azurite
Write-Host ""
Write-Host "Step 4: Checking Azurite (Azure Storage Emulator)..." -ForegroundColor Yellow
if (Test-CommandExists "azurite") {
    $azuriteVersion = azurite --version
    Write-Host "[OK] Azurite is installed: $azuriteVersion" -ForegroundColor Green
} else {
    Write-Host "[WARN] Azurite not found. Installing..." -ForegroundColor Yellow
    try {
        npm install -g azurite
        Write-Host "[OK] Azurite installed successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "[ERROR] Failed to install Azurite" -ForegroundColor Red
        Write-Host "  Please run manually: npm install -g azurite" -ForegroundColor Red
        exit 1
    }
}

# Step 5: Create API directory structure
Write-Host ""
Write-Host "Step 5: Creating Azure Functions project structure..." -ForegroundColor Yellow
if (Test-Path "api") {
    Write-Host "[WARN] 'api' directory already exists. Skipping initialization." -ForegroundColor Yellow
} else {
    Write-Host "  Creating 'api' directory..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Path "api" | Out-Null
    
    Push-Location "api"
    
    Write-Host "  Initializing Azure Functions project..." -ForegroundColor Cyan
    func init --worker-runtime node --language typescript --model v4
    
    Write-Host "  Installing dependencies..." -ForegroundColor Cyan
    npm install
    
    Write-Host "  Installing Azure Storage SDK..." -ForegroundColor Cyan
    npm install @azure/data-tables @azure/storage-blob
    
    Write-Host "  Installing additional dependencies..." -ForegroundColor Cyan
    npm install @azure/identity dotenv
    npm install --save-dev @types/node typescript
    
    Pop-Location
    
    Write-Host "[OK] Azure Functions project created successfully" -ForegroundColor Green
}

# Step 6: Create local.settings.json
Write-Host ""
Write-Host "Step 6: Creating local.settings.json..." -ForegroundColor Yellow
$localSettingsPath = "api/local.settings.json"
if (Test-Path $localSettingsPath) {
    Write-Host "[WARN] local.settings.json already exists. Skipping." -ForegroundColor Yellow
} else {
    $localSettings = @{
        IsEncrypted = $false
        Values = @{
            AzureWebJobsStorage = "UseDevelopmentStorage=true"
            FUNCTIONS_WORKER_RUNTIME = "node"
            AzureWebJobsFeatureFlags = "EnableWorkerIndexing"
            AZURE_STORAGE_CONNECTION_STRING = "UseDevelopmentStorage=true"
            NODE_ENV = "development"
        }
        Host = @{
            LocalHttpPort = 7071
            CORS = "*"
            CORSCredentials = $false
        }
    }
    
    $localSettings | ConvertTo-Json -Depth 10 | Set-Content $localSettingsPath
    Write-Host "[OK] local.settings.json created successfully" -ForegroundColor Green
}

# Step 7: Create Azurite data directory
Write-Host ""
Write-Host "Step 7: Creating Azurite data directory..." -ForegroundColor Yellow
$azuriteDir = "C:\azurite"
if (Test-Path $azuriteDir) {
    Write-Host "[OK] Azurite directory already exists: $azuriteDir" -ForegroundColor Green
} else {
    New-Item -ItemType Directory -Path $azuriteDir | Out-Null
    Write-Host "[OK] Azurite directory created: $azuriteDir" -ForegroundColor Green
}

# Step 8: Create a sample health check function
Write-Host ""
Write-Host "Step 8: Creating sample HealthCheck function..." -ForegroundColor Yellow
if (Test-Path "api/src/functions/HealthCheck.ts") {
    Write-Host "[WARN] HealthCheck function already exists. Skipping." -ForegroundColor Yellow
} else {
    Push-Location "api"
    func new --name HealthCheck --template "HTTP trigger" --authlevel anonymous
    Pop-Location
    Write-Host "[OK] HealthCheck function created successfully" -ForegroundColor Green
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Start Azurite in a separate terminal:" -ForegroundColor White
Write-Host "   azurite --silent --location C:\azurite" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Start Azure Functions in another terminal:" -ForegroundColor White
Write-Host "   cd api" -ForegroundColor Cyan
Write-Host "   func start" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Test your setup by visiting:" -ForegroundColor White
Write-Host "   http://localhost:7071/api/HealthCheck" -ForegroundColor Cyan
Write-Host ""
Write-Host "For detailed documentation, see: docs/06-local-dev-setup.md" -ForegroundColor Yellow
Write-Host ""

# Made with Bob
