# Initialize Database with Default Admin User
# Menu entrypoint — run with no arguments for the interactive menu, or
# pass a mode flag directly:
#   -Mode seed       : create the default admin user (default behaviour)
#   -Mode reset      : forward to reset-patient-data.ps1 (interactive)
#   -Mode reset-dry  : forward to reset-patient-data.ps1 -WhatIf
#   -Mode reset-force: forward to reset-patient-data.ps1 -Force
param(
    [ValidateSet('seed', 'reset', 'reset-dry', 'reset-force', 'peek', '')]
    [string]$Mode = ''
)

# ── Interactive menu when no mode is supplied ──────────────────────────────────
if ($Mode -eq '') {
    Write-Host ''
    Write-Host '╔══════════════════════════════════════════════════════╗' -ForegroundColor Cyan
    Write-Host '  Database Initialization Tool' -ForegroundColor Cyan
    Write-Host '╚══════════════════════════════════════════════════════╝' -ForegroundColor Cyan
    Write-Host ''
    Write-Host '  1) Seed default admin user (first-time setup)' -ForegroundColor White
    Write-Host '  2) Reset patient & examination data (dry run / preview)' -ForegroundColor White
    Write-Host '  3) Reset patient & examination data (delete, with confirmation)' -ForegroundColor White
    Write-Host '  4) Reset patient & examination data (delete, no prompt)' -ForegroundColor White
    Write-Host '  5) Peek — print first 5 rows from each table' -ForegroundColor White
    Write-Host '  Q) Quit' -ForegroundColor White
    Write-Host ''
    $choice = Read-Host '  Select option'
    switch ($choice.Trim().ToUpper()) {
        '1' { $Mode = 'seed' }
        '2' { $Mode = 'reset-dry' }
        '3' { $Mode = 'reset' }
        '4' { $Mode = 'reset-force' }
        '5' { $Mode = 'peek' }
        'Q' { Write-Host '  Quit.' -ForegroundColor Yellow; exit 0 }
        default {
            Write-Host "  Unknown option '$choice'. Defaulting to seed." -ForegroundColor Yellow
            $Mode = 'seed'
        }
    }
    Write-Host ''
}

# ── Peek mode — print first 5 rows from each table ────────────────────────────
function Invoke-PeekTables {
    $cs = $env:AZURE_STORAGE_CONNECTION_STRING
    if (-not $cs) { $cs = 'UseDevelopmentStorage=true' }

    # Parse connection string the same way reset-patient-data.ps1 does
    if ($cs -eq 'UseDevelopmentStorage=true') {
        $accountName   = 'devstoreaccount1'
        $accountKey    = 'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=='
        $tableEndpoint = 'http://127.0.0.1:10002/devstoreaccount1'
    } else {
        $parts = @{}
        foreach ($segment in $cs -split ';') {
            $idx = $segment.IndexOf('=')
            if ($idx -gt 0) {
                $parts[$segment.Substring(0, $idx).Trim()] = $segment.Substring($idx + 1).Trim()
            }
        }
        $accountName = $parts['AccountName']
        $accountKey  = $parts['AccountKey']
        if ($parts.ContainsKey('TableEndpoint')) {
            $tableEndpoint = $parts['TableEndpoint'].TrimEnd('/')
        } else {
            $proto = if ($parts['DefaultEndpointsProtocol']) { $parts['DefaultEndpointsProtocol'] } else { 'https' }
            $tableEndpoint = "${proto}://${accountName}.table.core.windows.net"
        }
    }

    # Fields to skip — internal OData / storage noise
    $skipFields = @('odata.metadata', 'Timestamp')

    # Keys to highlight in a distinct colour per table
    $highlightKeys = @{
        Users        = @('username', 'role', 'isActive', 'isDeleted', 'email')
        Patients     = @('mrn', 'patientId', 'PartitionKey')
        Examinations = @('PartitionKey', 'RowKey', 'mrn', 'patientId')
        AuditLogs    = @('action', 'username', 'actionTimestamp')
    }

    $tables = @('Users', 'Patients', 'Examinations', 'AuditLogs')
    $width  = 72

    Write-Host ''
    Write-Host ('╔' + '═' * $width + '╗') -ForegroundColor Cyan
    Write-Host ('║' + ("  Peek — first 5 rows per table").PadRight($width) + '║') -ForegroundColor Cyan
    Write-Host ('║' + ("  $accountName  ·  $tableEndpoint").PadRight($width) + '║') -ForegroundColor DarkGray
    Write-Host ('╚' + '═' * $width + '╝') -ForegroundColor Cyan

    foreach ($table in $tables) {

        $date      = [System.DateTime]::UtcNow.ToString('R')
        $url       = "$tableEndpoint/${table}()?`$top=5"
        $uriPath   = [Uri]::new($url).AbsolutePath
        $canonical = "/$accountName$uriPath"

        $keyBytes     = [System.Convert]::FromBase64String($accountKey)
        $hmac         = [System.Security.Cryptography.HMACSHA256]::new($keyBytes)
        $stringToSign = "$date`n$canonical"
        $signBytes    = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($stringToSign))
        $signature    = [System.Convert]::ToBase64String($signBytes)
        $hmac.Dispose()

        $headers = @{
            'Authorization'      = "SharedKeyLite ${accountName}:${signature}"
            'x-ms-date'          = $date
            'x-ms-version'       = '2020-12-06'
            'Accept'             = 'application/json;odata=nometadata'
            'DataServiceVersion' = '3.0;NetFx'
        }

        Write-Host ''
        Write-Host ('  ┌─  ' + $table + '  ' + ('─' * ([Math]::Max(0, $width - 5 - $table.Length)))) -ForegroundColor Cyan

        try {
            $resp = Invoke-RestMethod -Uri $url -Headers $headers -Method GET -ErrorAction Stop
            $rows = $resp.value

            if (-not $rows -or $rows.Count -eq 0) {
                Write-Host '  │  (empty)' -ForegroundColor DarkGray
            } else {
                $hi = if ($highlightKeys.ContainsKey($table)) { $highlightKeys[$table] } else { @() }
                $rowNum = 0
                foreach ($row in $rows) {
                    $rowNum++
                    if ($rowNum -gt 1) { Write-Host '  │' -ForegroundColor DarkGray }
                    Write-Host "  │  ── row $rowNum ──" -ForegroundColor DarkGray
                    $props = $row.PSObject.Properties |
                             Where-Object { $skipFields -notcontains $_.Name } |
                             Sort-Object { if ($_.Name -in @('PartitionKey','RowKey')) { 0 } else { 1 } }
                    foreach ($prop in $props) {
                        $key   = $prop.Name
                        $val   = if ($null -eq $prop.Value) { '(null)' } else { "$($prop.Value)" }
                        # Truncate very long values (e.g. passwordHash)
                        if ($val.Length -gt 60) { $val = $val.Substring(0, 57) + '...' }
                        $label = "  │    $($key.PadRight(22))"
                        if ($key -in $hi) {
                            Write-Host $label -NoNewline -ForegroundColor DarkGray
                            Write-Host $val   -ForegroundColor Yellow
                        } else {
                            Write-Host $label -NoNewline -ForegroundColor DarkGray
                            Write-Host $val   -ForegroundColor White
                        }
                    }
                }
                Write-Host "  │" -ForegroundColor DarkGray
                Write-Host "  │  $rowNum row(s) shown  (table may contain more)" -ForegroundColor DarkGray
            }
        } catch {
            $code = $_.Exception.Response.StatusCode.value__
            if ($code -eq 404) {
                Write-Host '  │  (table does not exist yet)' -ForegroundColor DarkGray
            } else {
                Write-Host "  │  [ERROR] $($_.Exception.Message)" -ForegroundColor Red
            }
        }

        Write-Host ('  └' + '─' * ($width - 1)) -ForegroundColor Cyan
    }
    Write-Host ''
}

if ($Mode -eq 'peek') {
    Invoke-PeekTables
    exit 0
}

# ── Delegate reset modes to reset-patient-data.ps1 ────────────────────────────
if ($Mode -in 'reset', 'reset-dry', 'reset-force') {
    $resetScript = Join-Path $PSScriptRoot 'reset-patient-data.ps1'
    if (-not (Test-Path $resetScript)) {
        Write-Host "  [ERROR] reset-patient-data.ps1 not found at: $resetScript" -ForegroundColor Red
        exit 1
    }
    $resetArgs = switch ($Mode) {
        'reset-dry'   { @{ WhatIf = $true } }
        'reset-force' { @{ Force  = $true } }
        default       { @{} }
    }
    & $resetScript @resetArgs
    exit $LASTEXITCODE
}

# ── Seed mode (default) ────────────────────────────────────────────────────────
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
    fullName = "System Administrator"
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
        Write-Host 'curl -v -X POST http://localhost:7071/api/v1/auth/register -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"Admin123!@#$\",\"fullName\":\"System Administrator\",\"email\":\"admin@example.com\",\"role\":\"admin\"}"' -ForegroundColor White
        
        Write-Host "`nCheck the backend logs in Terminal 2 for the actual error." -ForegroundColor Yellow
        Write-Host "========================================`n" -ForegroundColor Red
        
        exit 1
    }
}

# Made with Bob