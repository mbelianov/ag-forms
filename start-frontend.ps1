# Start Frontend Development Server
# This script starts the Vite development server for the AG Forms frontend

Write-Host "Starting AG Forms Frontend..." -ForegroundColor Green
Write-Host "Server will be available at: http://127.0.0.1:3000" -ForegroundColor Cyan
Write-Host "API requests will be proxied to: http://localhost:7071" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Change to frontend directory and start dev server
Set-Location -Path "$PSScriptRoot\frontend"
npm run dev

# Made with Bob
