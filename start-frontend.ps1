# Start Frontend Development Server
Write-Host "Starting frontend development server..." -ForegroundColor Green

# Check if frontend directory exists
if (-not (Test-Path "frontend")) {
    Write-Host "Error: Frontend directory not found. Run setup-frontend.ps1 first." -ForegroundColor Red
    exit 1
}

# Navigate to frontend directory
Push-Location frontend

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Error: Dependencies not installed. Run setup-frontend.ps1 first." -ForegroundColor Red
    Pop-Location
    exit 1
}

# Start development server
Write-Host "Starting Vite dev server on http://localhost:3000..." -ForegroundColor Cyan
npm run dev

# Return to project root
Pop-Location

# Made with Bob