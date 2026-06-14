# Start Azurite (Azure Storage Emulator)
# This script starts Azurite for local Azure Storage development

Write-Host "Starting Azurite (Azure Storage Emulator)..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

# Create azurite directory if it doesn't exist
$azuriteDir = "C:\azurite"
if (-not (Test-Path $azuriteDir)) {
    Write-Host "Creating Azurite data directory: $azuriteDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $azuriteDir | Out-Null
}

# Start Azurite
Write-Host "Azurite endpoints:" -ForegroundColor Green
Write-Host "  Tables: http://127.0.0.1:10002" -ForegroundColor White
Write-Host "  Blobs:  http://127.0.0.1:10000" -ForegroundColor White
Write-Host "  Queues: http://127.0.0.1:10001" -ForegroundColor White
Write-Host ""

azurite --silent --location C:\azurite --debug C:\azurite\debug.log

# Made with Bob
