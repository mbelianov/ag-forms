# Initialize Database with Default Admin User
# Menu entrypoint — run with no arguments for the interactive menu, or
# pass a mode flag directly:
#   -Mode seed              : create the default admin user (default behaviour)
#   -Mode reset             : forward to reset-patient-data.ps1 (interactive)
#   -Mode reset-dry         : forward to reset-patient-data.ps1 -WhatIf
#   -Mode reset-force       : forward to reset-patient-data.ps1 -Force
#   -Mode generate-patients : insert 1000 random patients (UI load testing)
#   -Mode counts            : show total patients and examinations in the database
param(
    [ValidateSet('seed', 'reset', 'reset-dry', 'reset-force', 'peek', 'generate-patients', 'counts', '')]
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
    Write-Host '  6) Generate 1000 random patients (UI load testing)' -ForegroundColor White
    Write-Host '  7) Show totals — patients & examinations count' -ForegroundColor White
    Write-Host '  Q) Quit' -ForegroundColor White
    Write-Host ''
    $choice = Read-Host '  Select option'
    switch ($choice.Trim().ToUpper()) {
        '1' { $Mode = 'seed' }
        '2' { $Mode = 'reset-dry' }
        '3' { $Mode = 'reset' }
        '4' { $Mode = 'reset-force' }
        '5' { $Mode = 'peek' }
        '6' { $Mode = 'generate-patients' }
        '7' { $Mode = 'counts' }
        'Q' { Write-Host '  Quit.' -ForegroundColor Yellow; exit 0 }
        default {
            Write-Host "  Unknown option '$choice'. Defaulting to seed." -ForegroundColor Yellow
            $Mode = 'seed'
        }
    }
    Write-Host ''
}

# ── Shared: resolve storage credentials from env / emulator ──────────────────
function Get-StorageCredentials {
    $cs = $env:AZURE_STORAGE_CONNECTION_STRING
    if (-not $cs) { $cs = 'UseDevelopmentStorage=true' }

    if ($cs -eq 'UseDevelopmentStorage=true') {
        return @{
            AccountName   = 'devstoreaccount1'
            AccountKey    = 'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=='
            TableEndpoint = 'http://127.0.0.1:10002/devstoreaccount1'
        }
    }

    $parts = @{}
    foreach ($segment in $cs -split ';') {
        $idx = $segment.IndexOf('=')
        if ($idx -gt 0) { $parts[$segment.Substring(0, $idx).Trim()] = $segment.Substring($idx + 1).Trim() }
    }
    $proto    = if ($parts['DefaultEndpointsProtocol']) { $parts['DefaultEndpointsProtocol'] } else { 'https' }
    $endpoint = if ($parts.ContainsKey('TableEndpoint')) { $parts['TableEndpoint'].TrimEnd('/') } `
                else { "${proto}://$($parts['AccountName']).table.core.windows.net" }
    return @{
        AccountName   = $parts['AccountName']
        AccountKey    = $parts['AccountKey']
        TableEndpoint = $endpoint
    }
}

# ── Shared: build SharedKeyLite auth headers for one Table Storage request ────
function Get-TableAuthHeaders([string]$accountName, [string]$accountKey, [string]$url) {
    $date      = [System.DateTime]::UtcNow.ToString('R')
    $uriPath   = [Uri]::new($url).AbsolutePath
    $canonical = "/$accountName$uriPath"
    $keyBytes  = [System.Convert]::FromBase64String($accountKey)
    $hmac      = [System.Security.Cryptography.HMACSHA256]::new($keyBytes)
    $sig       = [System.Convert]::ToBase64String(
                     $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes("$date`n$canonical")))
    $hmac.Dispose()
    return @{
        'Authorization'      = "SharedKeyLite ${accountName}:${sig}"
        'x-ms-date'          = $date
        'x-ms-version'       = '2020-12-06'
        'Accept'             = 'application/json;odata=nometadata'
        'DataServiceVersion' = '3.0;NetFx'
    }
}

# ── Counts mode — total patients and examinations ─────────────────────────────
function Invoke-ShowCounts {
    $creds         = Get-StorageCredentials
    $accountName   = $creds.AccountName
    $accountKey    = $creds.AccountKey
    $tableEndpoint = $creds.TableEndpoint
    $width         = 54

    Write-Host ''
    Write-Host ('╔' + '═' * $width + '╗') -ForegroundColor Cyan
    Write-Host ('║' + ('  Database Totals').PadRight($width) + '║') -ForegroundColor Cyan
    Write-Host ('║' + ("  $accountName").PadRight($width) + '║') -ForegroundColor DarkGray
    Write-Host ('╚' + '═' * $width + '╝') -ForegroundColor Cyan
    Write-Host ''

    # Helper: page through ALL rows in a table, counting only those that match
    # an optional PartitionKey prefix and where isDeleted ne true.
    # Azure Table Storage has no $count support, so we read in 1000-row pages.
    function Get-TableCount([string]$table, [string]$pkFilter) {
        $total = 0
        $continuationPK = $null
        $continuationRK = $null

        do {
            $filter = $pkFilter
            if ($filter) { $filter = [Uri]::EscapeDataString($filter) }
            $url = "$tableEndpoint/${table}()?`$top=1000&`$select=PartitionKey,isDeleted"
            if ($filter)            { $url += "&`$filter=$filter" }
            if ($continuationPK)    { $url += "&NextPartitionKey=$continuationPK" }
            if ($continuationRK)    { $url += "&NextRowKey=$continuationRK" }

            $headers = Get-TableAuthHeaders $accountName $accountKey $url

            try {
                $resp   = Invoke-WebRequest -Uri $url -Headers $headers -Method GET -ErrorAction Stop
                $body   = $resp.Content | ConvertFrom-Json
                $rows   = $body.value
                $total += ($rows | Where-Object { $_.isDeleted -ne $true }).Count

                # Continuation tokens come back as response headers
                $continuationPK = $resp.Headers['x-ms-continuation-NextPartitionKey']
                $continuationRK = $resp.Headers['x-ms-continuation-NextRowKey']
            } catch {
                $code = $_.Exception.Response.StatusCode.value__
                if ($code -eq 404) { return -1 }   # table doesn't exist yet
                throw
            }
        } while ($continuationPK)

        return $total
    }

    # ── Patients: PartitionKey = 'PATIENT' (main rows only, not search rows) ──
    Write-Host '  Counting patients...' -ForegroundColor DarkGray
    $patientFilter = "PartitionKey eq 'PATIENT' and isDeleted ne true"
    $patientCount  = Get-TableCount 'Patients' $patientFilter

    # ── Examinations: PartitionKey starts with 'EXAM/' (direct-lookup rows) ──
    # Each exam is stored 3 times; we count only the EXAM/{id} rows.
    Write-Host '  Counting examinations...' -ForegroundColor DarkGray
    $examFilter = "PartitionKey ge 'EXAM/' and PartitionKey lt 'EXAM0' and isDeleted ne true"
    $examCount  = Get-TableCount 'Examinations' $examFilter

    Write-Host ''
    Write-Host ('  ┌' + '─' * $width + '┐') -ForegroundColor Cyan

    function Write-CountRow([string]$label, $value, [string]$color) {
        $valStr = if ($value -eq -1) { '(table not found)' } else { "$value" }
        $line   = "  $($label.PadRight(30))$valStr"
        Write-Host ('  │') -NoNewline -ForegroundColor Cyan
        Write-Host $line.PadRight($width) -NoNewline -ForegroundColor $color
        Write-Host ('│') -ForegroundColor Cyan
    }

    Write-CountRow 'Total patients'     $patientCount 'Yellow'
    Write-CountRow 'Total examinations' $examCount    'Yellow'

    Write-Host ('  └' + '─' * $width + '┘') -ForegroundColor Cyan
    Write-Host ''
}

if ($Mode -eq 'counts') {
    Invoke-ShowCounts
    exit 0
}

# ── Peek mode — print first 5 rows from each table ────────────────────────────
function Invoke-PeekTables {
    $creds         = Get-StorageCredentials
    $accountName   = $creds.AccountName
    $accountKey    = $creds.AccountKey
    $tableEndpoint = $creds.TableEndpoint

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

        $url     = "$tableEndpoint/${table}()?`$top=5"
        $headers = Get-TableAuthHeaders $accountName $accountKey $url

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

# ── Generate-patients mode — insert 1000 random patients ──────────────────────
function Invoke-GeneratePatients {
    param([int]$Count = 1000)

    $baseUrl = 'http://localhost:7071/api'

    # ── 1. Verify backend is up ────────────────────────────────────────────────
    try {
        $null = Invoke-WebRequest -Uri "$baseUrl/HealthCheck" -Method GET -TimeoutSec 5 -ErrorAction Stop
    } catch {
        Write-Host '  [ERROR] Backend is not running. Start it with ./start-functions.ps1' -ForegroundColor Red
        exit 1
    }

    # ── 2. Log in as admin to obtain a session token ───────────────────────────
    Write-Host '  Authenticating as admin...' -ForegroundColor Yellow
    $loginBody = @{ username = 'admin'; password = 'Admin123!@#$' } | ConvertTo-Json
    try {
        $loginResp = Invoke-RestMethod -Uri "$baseUrl/v1/auth/login" `
            -Method POST -Body $loginBody `
            -ContentType 'application/json' -ErrorAction Stop `
            -SessionVariable webSession
        # The response envelope is { success, data: { user, token? } }
        $token = $loginResp.data.token
    } catch {
        Write-Host "  [ERROR] Login failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }

    $authHeaders = @{ 'Content-Type' = 'application/json' }
    if ($token) { $authHeaders['Authorization'] = "Bearer $token" }

    # ── 3. Name data pools ─────────────────────────────────────────────────────
    $firstNamesFemale = @(
        'Мария','Ивана','Елена','Анна','Петя','Надя','Галина','Теодора','Виктория','Кристина',
        'Силвия','Деница','Ваня','Десислава','Яна','Зорница','Цветелина','Антония','Радостина','Ралица',
        'Боряна','Калина','Светлана','Нина','Станислава','Биляна','Евгения','Камелия','Лилия','Розалия',
        'Снежана','Цветина','Гергана','Веселина','Павлина','Миглена','Венета','Красимира','Даниела','Жени',
        'Sofia','Valentina','Isabella','Giulia','Emma','Olivia','Anastasia','Natalia','Ekaterina','Laura',
        'Aleksandra','Monika','Katarzyna','Agnieszka','Magdalena','Joanna','Alina','Irina','Oksana','Halyna'
    )
    $firstNamesMale = @(
        'Иван','Георги','Петър','Димитър','Александър','Николай','Стефан','Христо','Владимир','Борис',
        'Тодор','Андрей','Мартин','Веселин','Красимир','Калоян','Симеон','Валентин','Людмил','Станислав',
        'Плamen','Радослав','Йордан','Виктор','Емил','Милен','Атанас','Васил','Кирил','Методи',
        'Deyan','Rosen','Hristo','Dobrin','Ognyan','Boyan','Galin','Zahari','Tsvetelin','Miroslav',
        'Adam','Bartosz','Krzysztof','Maciej','Tomasz','Piotr','Andrzej','Michal','Lukasz','Rafal',
        'Aleksei','Dmitri','Sergei','Pavel','Mikhail','Nikolai','Viktor','Roman','Artem','Oleg'
    )
    $lastNames = @(
        'Иванов','Георгиев','Петров','Димитров','Александров','Николов','Стефанов','Христов','Колев','Тодоров',
        'Андреев','Маринов','Генов','Стоянов','Попов','Митев','Ангелов','Цветков','Иванова','Георгиева',
        'Петрова','Димитрова','Николова','Стефанова','Христова','Колева','Тодорова','Андреева','Маринова','Генова',
        'Kowalski','Nowak','Wiśniewski','Wójcik','Kowalczyk','Kamiński','Lewandowski','Zieliński','Szymański','Woźniak',
        'Ivanov','Smirnov','Kuznetsov','Popov','Sokolov','Lebedev','Kozlov','Novikov','Morozov','Petrov',
        'Bauer','Müller','Schmidt','Schneider','Fischer','Weber','Meyer','Wagner','Becker','Schulz',
        'Garcia','Martinez','Lopez','Gonzalez','Rodriguez','Hernandez','Perez','Sanchez','Ramirez','Torres'
    )

    # ── 4. Helper: random element from array ───────────────────────────────────
    function Get-RandomItem([array]$arr) { $arr[(Get-Random -Maximum $arr.Count)] }

    # ── 5. Helper: random birth date (age 18–80) ───────────────────────────────
    function Get-RandomBirthDate {
        $daysBack = (Get-Random -Minimum (18 * 365) -Maximum (80 * 365))
        [datetime]::UtcNow.AddDays(-$daysBack).ToString('yyyy-MM-dd')
    }

    # ── 6. Helper: random BG-style phone ──────────────────────────────────────
    function Get-RandomPhone {
        $prefix = @('+35988','+35987','+35989','+35982','+35983')
        $p = Get-RandomItem $prefix
        $digits = -join ((1..7) | ForEach-Object { Get-Random -Minimum 0 -Maximum 10 })
        "$p$digits"
    }

    # ── 7. Insert loop ─────────────────────────────────────────────────────────
    Write-Host ''
    Write-Host ('╔' + '═' * 54 + '╗') -ForegroundColor Cyan
    Write-Host ('║' + ("  Generating $Count random patients…").PadRight(54) + '║') -ForegroundColor Cyan
    Write-Host ('╚' + '═' * 54 + '╝') -ForegroundColor Cyan
    Write-Host ''

    $ok      = 0
    $skipped = 0
    $failed  = 0

    for ($i = 1; $i -le $Count; $i++) {
        # Pick gender randomly to pair first/last name
        $female = (Get-Random -Maximum 2) -eq 0
        $first  = if ($female) { Get-RandomItem $firstNamesFemale } else { Get-RandomItem $firstNamesMale }
        $last   = Get-RandomItem $lastNames
        # Add a random suffix number occasionally to reduce duplicates
        $suffix = if ((Get-Random -Maximum 5) -eq 0) { " $(Get-Random -Minimum 2 -Maximum 99)" } else { '' }
        $name   = "$first $last$suffix"

        $body = @{
            name      = $name
            birthDate = Get-RandomBirthDate
            phone     = Get-RandomPhone
        } | ConvertTo-Json

        try {
            $null = Invoke-RestMethod -Uri "$baseUrl/v1/patients" `
                -Method POST -Body $body -Headers $authHeaders `
                -WebSession $webSession -ErrorAction Stop
            $ok++
        } catch {
            $code = $_.Exception.Response.StatusCode.value__
            if ($code -eq 409) { $skipped++ } else { $failed++ }
        }

        # Progress bar every 50 records
        if ($i % 50 -eq 0 -or $i -eq $Count) {
            $pct   = [int](($i / $Count) * 100)
            $bar   = ('█' * [int]($pct / 5)).PadRight(20)
            Write-Host "`r  [$bar] $pct%  ($i/$Count)  ok=$ok  skip=$skipped  fail=$failed   " -NoNewline -ForegroundColor Cyan
        }
    }

    Write-Host ''
    Write-Host ''
    Write-Host ('╔' + '═' * 54 + '╗') -ForegroundColor Green
    Write-Host ('║' + ("  Done!  Inserted: $ok  Skipped: $skipped  Failed: $failed").PadRight(54) + '║') -ForegroundColor Green
    Write-Host ('╚' + '═' * 54 + '╝') -ForegroundColor Green
    Write-Host ''
}

if ($Mode -eq 'generate-patients') {
    Invoke-GeneratePatients -Count 1000
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