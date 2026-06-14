# Start Azure Functions Runtime
# This script starts the Azure Functions local development server

Write-Host "Starting Azure Functions Runtime..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

# Check if api directory exists
if (-not (Test-Path "api")) {
    Write-Host "Error: 'api' directory not found!" -ForegroundColor Red
    Write-Host "Please run setup-dev-environment.ps1 first" -ForegroundColor Yellow
    exit 1
}

# Check if Azurite is running
Write-Host "Checking if Azurite is running..." -ForegroundColor Yellow
$azuriteRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:10002" -Method GET -TimeoutSec 2 -ErrorAction SilentlyContinue
    $azuriteRunning = $true
} catch {
    # Azurite not running
}

if (-not $azuriteRunning) {
    Write-Host "⚠ Warning: Azurite does not appear to be running" -ForegroundColor Yellow
    Write-Host "  Please start Azurite in a separate terminal:" -ForegroundColor Yellow
    Write-Host "  .\start-azurite.ps1" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Continuing anyway..." -ForegroundColor Yellow
    Write-Host ""
}

# Change to api directory and start functions
Push-Location "api"

Write-Host "Azure Functions will be available at:" -ForegroundColor Green
Write-Host "  http://localhost:7071" -ForegroundColor White
Write-Host ""
Write-Host "CORS enabled for: http://localhost:3000, http://localhost:5173" -ForegroundColor Green
Write-Host ""

func start --cors "http://localhost:3000,http://localhost:5173"

Pop-Location

# Made with Bob
