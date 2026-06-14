# Initialize Database with Default Admin User
Write-Host "Initializing database..." -ForegroundColor Green

# Check if backend is running
$backendRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:7071/api/HealthCheck" -Method GET -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        $backendRunning = $true
    }
} catch {
    $backendRunning = $false
}

if (-not $backendRunning) {
    Write-Host "Error: Backend is not running. Please start it first with ./start-functions.ps1" -ForegroundColor Red
    exit 1
}

Write-Host "Backend is running. Creating admin user..." -ForegroundColor Yellow
Write-Host "(Tables will be created automatically on first user registration)" -ForegroundColor Gray

# Create default admin user
$adminUser = @{
    username = "admin"
    password = "Admin123!@#$"
    email = "admin@example.com"
    role = "admin"
} | ConvertTo-Json

# The correct endpoint based on Register.ts line 140
$registerEndpoint = "http://localhost:7071/api/v1/auth/register"

try {
    Write-Host "`nAttempting to register admin user at: $registerEndpoint" -ForegroundColor Gray
    
    $headers = @{
        "Content-Type" = "application/json"
    }
    
    $registerResponse = Invoke-RestMethod -Uri $registerEndpoint -Method POST -Body $adminUser -Headers $headers -ErrorAction Stop
    
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "Database initialized successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "`nDefault Admin User Created:" -ForegroundColor Cyan
    Write-Host "  Username: admin" -ForegroundColor White
    Write-Host "  Password: Admin123!@#$" -ForegroundColor White
    Write-Host "  Email: admin@example.com" -ForegroundColor White
    Write-Host "  Role: admin" -ForegroundColor White
    Write-Host "`nYou can now log in at: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Green
    
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorMessage = $_.Exception.Message
    
    # Try to get detailed error from response body
    $responseBody = ""
    try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        $reader.Close()
    } catch {
        # Ignore if we can't read the response
    }
    
    # Check for specific error conditions
    if ($statusCode -eq 409 -or $errorMessage -like "*already exists*" -or $responseBody -like "*already exists*") {
        Write-Host "`n========================================" -ForegroundColor Yellow
        Write-Host "Admin user already exists!" -ForegroundColor Yellow
        Write-Host "========================================" -ForegroundColor Yellow
        Write-Host "`nExisting Admin User:" -ForegroundColor Cyan
        Write-Host "  Username: admin" -ForegroundColor White
        Write-Host "  Password: Admin123!@#$" -ForegroundColor White
        Write-Host "`nYou can log in at: http://localhost:3000" -ForegroundColor Cyan
        Write-Host "========================================`n" -ForegroundColor Yellow
    } else {
        Write-Host "`n========================================" -ForegroundColor Red
        Write-Host "Failed to create admin user" -ForegroundColor Red
        Write-Host "========================================" -ForegroundColor Red
        Write-Host "`nError Details:" -ForegroundColor Yellow
        Write-Host "  Status Code: $statusCode" -ForegroundColor White
        Write-Host "  Error Message: $errorMessage" -ForegroundColor White
        
        if ($responseBody) {
            Write-Host "`nResponse Body:" -ForegroundColor Yellow
            Write-Host $responseBody -ForegroundColor White
        }
        
        Write-Host "`nPossible issues:" -ForegroundColor Yellow
        Write-Host "1. Validation error - check that the user data meets requirements" -ForegroundColor White
        Write-Host "2. Backend error - check Terminal 2 (backend logs) for detailed error messages" -ForegroundColor White
        Write-Host "3. Azurite connection issue - ensure Terminal 1 (Azurite) is running" -ForegroundColor White
        
        Write-Host "`nManual registration command (for debugging):" -ForegroundColor Cyan
        Write-Host 'curl -v -X POST http://localhost:7071/api/v1/auth/register -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"Admin123!@#$\",\"email\":\"admin@example.com\",\"role\":\"admin\"}"' -ForegroundColor White
        
        Write-Host "`nCheck the backend logs in Terminal 2 for the actual error." -ForegroundColor Yellow
        Write-Host "========================================`n" -ForegroundColor Red
        
        exit 1
    }
}

# Made with Bob