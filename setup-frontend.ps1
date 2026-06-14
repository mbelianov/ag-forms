# Setup Frontend Development Environment
Write-Host "Setting up frontend development environment..." -ForegroundColor Green

# Check if Node.js is installed
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Node.js is not installed" -ForegroundColor Red
    exit 1
}

# Create frontend directory if it doesn't exist
if (-not (Test-Path "frontend")) {
    Write-Host "Creating frontend with Vite..." -ForegroundColor Yellow
    npm create vite@latest frontend -- --template react-ts
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to create Vite project" -ForegroundColor Red
        exit 1
    }
}

# Navigate to frontend directory
Push-Location frontend

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

# Install Carbon Design System
Write-Host "Installing Carbon Design System..." -ForegroundColor Yellow
npm install @carbon/react@^1.72.2 @carbon/icons-react@^11.54.0

# Install additional dependencies
Write-Host "Installing additional dependencies..." -ForegroundColor Yellow
npm install react-router-dom@^6.28.0 axios@^1.7.9 jspdf@^2.5.2 date-fns@^4.1.0

Write-Host "Frontend setup complete!" -ForegroundColor Green
Write-Host "To start development server: cd frontend && npm run dev" -ForegroundColor Cyan

# Return to project root
Pop-Location

# Made with Bob