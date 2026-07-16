# Initialize Database with Default Admin User
# Menu entrypoint — run with no arguments for the interactive menu, or
# pass a mode flag directly:
#   -Mode seed              : create the default admin user (default behaviour)
#   -Mode reset             : forward to reset-patient-data.ps1 (interactive), then zero counters
#   -Mode reset-dry         : forward to reset-patient-data.ps1 -WhatIf (no counter changes)
#   -Mode reset-force       : forward to reset-patient-data.ps1 -Force,   then zero counters
#   -Mode generate-patients : insert 1000 patients + 2000 exams, then reconcile counters
#   -Mode counts            : show totals and counter consistency check
#   -Mode repair-counters   : reconcile PATIENT_TOTAL / EXAM_TOTAL from a ground-truth scan
param(
    [ValidateSet('seed', 'reset', 'reset-dry', 'reset-force', 'peek', 'generate-patients', 'counts', 'repair-counters', '')]
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
    Write-Host '  6) Generate 1000 random patients + 2000 examinations (UI load testing)' -ForegroundColor White
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

# ── Shared: read a single counter value from the Counters table ───────────────
function Get-CounterValue([string]$rowKey) {
    $creds         = Get-StorageCredentials
    $accountName   = $creds.AccountName
    $accountKey    = $creds.AccountKey
    $tableEndpoint = $creds.TableEndpoint

    $pk  = [Uri]::EscapeDataString('COUNTER')
    $rk  = [Uri]::EscapeDataString($rowKey)
    $url = "$tableEndpoint/Counters(PartitionKey='$pk',RowKey='$rk')"
    $headers = Get-TableAuthHeaders $accountName $accountKey $url

    try {
        $resp = Invoke-WebRequest -Uri $url -Headers $headers -Method GET -UseBasicParsing -ErrorAction Stop
        $body = $resp.Content | ConvertFrom-Json
        return [int]$body.value
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -eq 404) { return $null }   # counter row does not exist yet
        throw
    }
}

# ── Shared: upsert (create or overwrite) a counter row in the Counters table ──
function Set-CounterValue([string]$rowKey, [int]$value) {
    $creds         = Get-StorageCredentials
    $accountName   = $creds.AccountName
    $accountKey    = $creds.AccountKey
    $tableEndpoint = $creds.TableEndpoint

    $pk  = [Uri]::EscapeDataString('COUNTER')
    $rk  = [Uri]::EscapeDataString($rowKey)
    $url = "$tableEndpoint/Counters(PartitionKey='$pk',RowKey='$rk')"

    $body = @{
        PartitionKey  = 'COUNTER'
        RowKey        = $rowKey
        counterType   = $rowKey
        value         = $value
        lastUpdated   = [datetime]::UtcNow.ToString('o')
    } | ConvertTo-Json

    $date      = [System.DateTime]::UtcNow.ToString('R')
    $uriPath   = [Uri]::new($url).AbsolutePath
    $canonical = "/$accountName$uriPath"
    $keyBytes  = [System.Convert]::FromBase64String($accountKey)
    $hmac      = [System.Security.Cryptography.HMACSHA256]::new($keyBytes)
    $sig       = [System.Convert]::ToBase64String(
                     $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes("$date`n$canonical")))
    $hmac.Dispose()

    $headers = @{
        'Authorization'      = "SharedKeyLite ${accountName}:${sig}"
        'x-ms-date'          = $date
        'x-ms-version'       = '2020-12-06'
        'Accept'             = 'application/json;odata=nometadata'
        'DataServiceVersion' = '3.0;NetFx'
        'Content-Type'       = 'application/json'
        # No If-Match header — Azure Table Storage PUT to an entity URL
        # is "Insert Or Replace" (upsert) and needs no etag.
    }

    # PUT to the entity URL = Insert Or Replace (upsert)
    try {
        Invoke-RestMethod -Method PUT -Uri $url -Headers $headers -Body $body -ErrorAction Stop | Out-Null
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -eq 404) {
            # Counters table does not exist yet — create it first then retry
            $createUrl = "$tableEndpoint/Tables"
            $createHeaders = Get-TableAuthHeaders $accountName $accountKey $createUrl
            $createHeaders['Content-Type'] = 'application/json'
            $createBody = @{ TableName = 'Counters' } | ConvertTo-Json
            try {
                Invoke-RestMethod -Method POST -Uri $createUrl -Headers $createHeaders -Body $createBody -ErrorAction Stop | Out-Null
            } catch { <# 409 = already exists — ignore #> }
            # Retry the upsert now that the table exists
            Invoke-RestMethod -Method PUT -Uri $url -Headers $headers -Body $body -ErrorAction Stop | Out-Null
        } else {
            throw
        }
    }
}

# ── Shared: ground-truth scan — count non-deleted rows in a partition ──────────
# Azure Table Storage has no $count; we page through 1000-row batches.
# Returns -1 when the table does not exist.
function Get-TrueCount([string]$table, [string]$pkFilter) {
    $creds         = Get-StorageCredentials
    $accountName   = $creds.AccountName
    $accountKey    = $creds.AccountKey
    $tableEndpoint = $creds.TableEndpoint

    $total          = 0
    $continuationPK = $null
    $continuationRK = $null

    do {
        $filter = $pkFilter
        if ($filter) { $filter = [Uri]::EscapeDataString($filter) }
        $url = "$tableEndpoint/${table}()?`$top=1000&`$select=PartitionKey,isDeleted"
        if ($filter)         { $url += "&`$filter=$filter" }
        if ($continuationPK) { $url += "&NextPartitionKey=$continuationPK" }
        if ($continuationRK) { $url += "&NextRowKey=$continuationRK" }

        $headers = Get-TableAuthHeaders $accountName $accountKey $url

        try {
            $resp   = Invoke-WebRequest -Uri $url -Headers $headers -Method GET -UseBasicParsing -ErrorAction Stop
            $body   = $resp.Content | ConvertFrom-Json
            $rows   = $body.value
            $total += ($rows | Where-Object { $_.isDeleted -ne $true }).Count

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

# ── Counts mode — total patients and examinations ─────────────────────────────
function Invoke-ShowCounts {
    $width = 62

    Write-Host ''
    Write-Host ('╔' + '═' * $width + '╗') -ForegroundColor Cyan
    $creds = Get-StorageCredentials
    Write-Host ('║' + ('  Database Totals').PadRight($width) + '║') -ForegroundColor Cyan
    Write-Host ('║' + ("  $($creds.AccountName)").PadRight($width) + '║') -ForegroundColor DarkGray
    Write-Host ('╚' + '═' * $width + '╝') -ForegroundColor Cyan
    Write-Host ''

    # ── Ground-truth scans ────────────────────────────────────────────────────
    Write-Host '  Scanning database (ground truth)...' -ForegroundColor DarkGray
    $patientTrue = Get-TrueCount 'Patients'     "PartitionKey eq 'PATIENT' and isDeleted ne true"
    $examTrue    = Get-TrueCount 'Examinations' "PartitionKey eq 'EXAM'    and isDeleted ne true"

    # ── Counter row values ────────────────────────────────────────────────────
    Write-Host '  Reading counter rows...' -ForegroundColor DarkGray
    $patientCounter = Get-CounterValue 'PATIENT_TOTAL'
    $examCounter    = Get-CounterValue 'EXAM_TOTAL'

    $patientCounterStr = if ($null -eq $patientCounter) { '(missing)' } else { "$patientCounter" }
    $examCounterStr    = if ($null -eq $examCounter)    { '(missing)' } else { "$examCounter" }

    # ── Consistency check ─────────────────────────────────────────────────────
    $patientOk = ($null -ne $patientCounter) -and ($patientCounter -eq $patientTrue)
    $examOk    = ($null -ne $examCounter)    -and ($examCounter    -eq $examTrue)

    $patientStatus = if ($patientOk) { '✓ consistent' } else { '✗ DRIFT DETECTED' }
    $examStatus    = if ($examOk)    { '✓ consistent' } else { '✗ DRIFT DETECTED' }
    $patientColor  = if ($patientOk) { 'Green' } else { 'Red' }
    $examColor     = if ($examOk)    { 'Green' } else { 'Red' }

    # ── Display ───────────────────────────────────────────────────────────────
    function Write-CountRow([string]$label, $trueVal, [string]$counterStr, [string]$status, [string]$statusColor) {
        $trueStr = if ($trueVal -eq -1) { '(table not found)' } else { "$trueVal" }
        Write-Host ('  │') -NoNewline -ForegroundColor Cyan
        Write-Host ("  $($label.PadRight(22))") -NoNewline -ForegroundColor White
        Write-Host ("actual: $($trueStr.PadLeft(6))  counter: $($counterStr.PadLeft(6))  ") -NoNewline -ForegroundColor Yellow
        Write-Host ($status.PadRight(18)) -NoNewline -ForegroundColor $statusColor
        Write-Host ('│') -ForegroundColor Cyan
    }

    $hdr = '  ' + 'Metric'.PadRight(22) + 'Actual'.PadLeft(13) + '  Counter'.PadLeft(15) + '  Status'
    Write-Host ('  ┌' + '─' * $width + '┐') -ForegroundColor Cyan
    Write-Host ('  │') -NoNewline -ForegroundColor Cyan
    Write-Host ($hdr.PadRight($width)) -NoNewline -ForegroundColor DarkGray
    Write-Host ('│') -ForegroundColor Cyan
    Write-Host ('  ├' + '─' * $width + '┤') -ForegroundColor Cyan
    Write-CountRow 'Patients'     $patientTrue $patientCounterStr $patientStatus $patientColor
    Write-CountRow 'Examinations' $examTrue    $examCounterStr    $examStatus    $examColor
    Write-Host ('  └' + '─' * $width + '┘') -ForegroundColor Cyan
    Write-Host ''

    if (-not $patientOk -or -not $examOk) {
        Write-Host '  ⚠  Counter drift found. Run option 6 or use the repair below.' -ForegroundColor Yellow
        Write-Host '     To repair counters immediately, re-run with:' -ForegroundColor DarkGray
        Write-Host '       .\init-database.ps1 -Mode repair-counters' -ForegroundColor Cyan
        Write-Host ''
    } else {
        Write-Host '  All counters are consistent with the database.' -ForegroundColor Green
        Write-Host ''
    }
}

# ── Repair-counters mode — reconcile counters from a ground-truth scan ────────
function Invoke-RepairCounters {
    Write-Host ''
    Write-Host '  Repairing counters from ground-truth scan...' -ForegroundColor Yellow

    $patientTrue = Get-TrueCount 'Patients'     "PartitionKey eq 'PATIENT' and isDeleted ne true"
    $examTrue    = Get-TrueCount 'Examinations' "PartitionKey eq 'EXAM'    and isDeleted ne true"

    if ($patientTrue -eq -1) { $patientTrue = 0 }
    if ($examTrue    -eq -1) { $examTrue    = 0 }

    Set-CounterValue 'PATIENT_TOTAL' $patientTrue
    Write-Host "  PATIENT_TOTAL set to $patientTrue" -ForegroundColor Green

    Set-CounterValue 'EXAM_TOTAL' $examTrue
    Write-Host "  EXAM_TOTAL    set to $examTrue" -ForegroundColor Green
    Write-Host ''
}

if ($Mode -eq 'counts') {
    Invoke-ShowCounts
    exit 0
}

if ($Mode -eq 'repair-counters') {
    Invoke-RepairCounters
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

# ── Generate-patients mode — insert 1000 patients + 2 exams each ──────────────
function Invoke-GeneratePatients {
    param(
        [int]$PatientCount    = 1000,
        [int]$ExamsPerPatient = 2
    )

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

    # ── 4. Exam data pools ─────────────────────────────────────────────────────
    $examStatuses = @('draft', 'completed', 'reviewed')
    $examFindings = @(
        'Normal fetal development observed.',
        'No structural anomalies detected.',
        'Adequate amniotic fluid volume.',
        'Fetal movements present and regular.',
        'Placenta posterior, grade I.',
        'Fetal heart rate within normal limits.',
        'Biometry consistent with gestational age.',
        'Single live intrauterine fetus.',
        'Cervical length within normal range.',
        'No evidence of fetal distress.'
    )
    $examNotes = @(
        'Follow-up in 4 weeks.',
        'Routine monitoring recommended.',
        'Patient advised to report any unusual symptoms.',
        'Next scan scheduled as per protocol.',
        '',
        '',
        ''
    )
    $vessels = @('Umbilical artery','Middle cerebral artery','Uterine artery','Ductus venosus')

    # ── 5. Helpers ─────────────────────────────────────────────────────────────
    function Get-RandomItem([array]$arr) { $arr[(Get-Random -Maximum $arr.Count)] }

    function Get-RandomBirthDate {
        $daysBack = (Get-Random -Minimum (18 * 365) -Maximum (80 * 365))
        [datetime]::UtcNow.AddDays(-$daysBack).ToString('yyyy-MM-dd')
    }

    function Get-RandomPhone {
        $prefix = @('+35988','+35987','+35989','+35982','+35983')
        $p = Get-RandomItem $prefix
        $digits = -join ((1..7) | ForEach-Object { Get-Random -Minimum 0 -Maximum 10 })
        "$p$digits"
    }

    # Returns a random past exam date (up to 2 years ago) as yyyy-MM-dd
    function Get-RandomExamDate {
        $daysBack = Get-Random -Minimum 1 -Maximum 730
        [datetime]::UtcNow.AddDays(-$daysBack).ToString('yyyy-MM-dd')
    }

    # Returns a random gestational age string like "24w 3d"
    function Get-RandomGestationalAge {
        $weeks = Get-Random -Minimum 8 -Maximum 40
        $days  = Get-Random -Minimum 0 -Maximum 6
        "${weeks}w ${days}d"
    }

    # Returns a random biometry object (integer fields only, as required by validation)
    function Get-RandomBiometry {
        [PSCustomObject]@{
            bpd = Get-Random -Minimum 20 -Maximum 95
            hc  = Get-Random -Minimum 80 -Maximum 340
            ac  = Get-Random -Minimum 80 -Maximum 350
            fl  = Get-Random -Minimum 10 -Maximum 75
            efw = Get-Random -Minimum 100 -Maximum 4200
        }
    }

    # Returns a random doppler object (float fields, within schema ranges)
    function Get-RandomDoppler {
        $pi = [math]::Round((Get-Random -Minimum 50 -Maximum 300) / 100.0, 2)
        $ri = [math]::Round((Get-Random -Minimum 40 -Maximum 90) / 100.0, 2)
        [PSCustomObject]@{
            pi     = $pi
            ri     = $ri
            vessel = (Get-RandomItem $vessels)
        }
    }

    # ── 6. Phase 1: insert patients ────────────────────────────────────────────
    $totalExams = $PatientCount * $ExamsPerPatient
    Write-Host ''
    Write-Host ('╔' + '═' * 60 + '╗') -ForegroundColor Cyan
    Write-Host ('║' + ("  Generating $PatientCount patients + $totalExams examinations…").PadRight(60) + '║') -ForegroundColor Cyan
    Write-Host ('╚' + '═' * 60 + '╝') -ForegroundColor Cyan
    Write-Host ''
    Write-Host '  Phase 1/2 — Inserting patients' -ForegroundColor Yellow
    Write-Host ''

    $pOk = 0; $pSkip = 0; $pFail = 0

    for ($i = 1; $i -le $PatientCount; $i++) {
        $female = (Get-Random -Maximum 2) -eq 0
        $first  = if ($female) { Get-RandomItem $firstNamesFemale } else { Get-RandomItem $firstNamesMale }
        $last   = Get-RandomItem $lastNames
        $suffix = if ((Get-Random -Maximum 5) -eq 0) { " $(Get-Random -Minimum 2 -Maximum 99)" } else { '' }
        $name   = "$first $last$suffix"

        $patBody = [PSCustomObject]@{
            name      = $name
            birthDate = (Get-RandomBirthDate)
            phone     = (Get-RandomPhone)
        } | ConvertTo-Json

        # Use Invoke-WebRequest so we control status-code inspection directly.
        # Invoke-RestMethod in PowerShell 5.1 does not expose the HTTP status
        # on the exception object reliably — $_.Exception.Response is often null.
        try {
            $wr = Invoke-WebRequest -Uri "$baseUrl/v1/patients" `
                -Method POST -Body $patBody -Headers $authHeaders `
                -WebSession $webSession -UseBasicParsing -ErrorAction Stop
            if ($wr.StatusCode -eq 201) { $pOk++ } else { $pFail++ }
        } catch {
            # On 4xx/5xx Invoke-WebRequest throws; read the status from the response
            $errStatus = $null
            if ($_.Exception.Response -ne $null) {
                $errStatus = [int]$_.Exception.Response.StatusCode
            }
            if ($errStatus -eq 409) { $pSkip++ } else { $pFail++ }
        }

        if ($i % 50 -eq 0 -or $i -eq $PatientCount) {
            $pct = [int](($i / $PatientCount) * 100)
            $bar = ('█' * [int]($pct / 5)).PadRight(20)
            Write-Host "`r  [$bar] $pct%  ($i/$PatientCount)  ok=$pOk  skip=$pSkip  fail=$pFail   " -NoNewline -ForegroundColor Cyan
        }
    }

    Write-Host ''
    Write-Host ''
    Write-Host "  Patients inserted: $pOk  Skipped (duplicate): $pSkip  Failed: $pFail" -ForegroundColor Gray
    Write-Host ''

    # ── 7. Collect all patient IDs via paginated GET ───────────────────────────
    # We fetch IDs from the API rather than relying on insert responses so that
    # the exam phase works correctly even when patients already existed.
    Write-Host '  Collecting patient IDs...' -ForegroundColor DarkGray

    $patientIds = [System.Collections.Generic.List[string]]::new()
    $contToken  = $null

    do {
        $pageUrl = "$baseUrl/v1/patients?pageSize=100"
        if ($contToken) { $pageUrl += "&continuationToken=$([Uri]::EscapeDataString($contToken))" }

        try {
            $pageResp   = Invoke-RestMethod -Uri $pageUrl -Method GET -Headers $authHeaders `
                              -WebSession $webSession -ErrorAction Stop
            $pagePats   = $pageResp.data.patients
            foreach ($p in $pagePats) {
                if ($p.patientId) { $patientIds.Add($p.patientId) }
            }
            $contToken = $pageResp.data.continuationToken
        } catch {
            Write-Host "  [ERROR] Failed to fetch patient list: $($_.Exception.Message)" -ForegroundColor Red
            exit 1
        }
    } while ($contToken)

    Write-Host "  Collected $($patientIds.Count) patient IDs." -ForegroundColor Gray
    Write-Host ''

    if ($patientIds.Count -eq 0) {
        Write-Host '  [WARN] No patient IDs collected — skipping exam generation.' -ForegroundColor Yellow
        exit 0
    }

    # ── 8. Phase 2: insert examinations (ExamsPerPatient per patient) ──────────
    Write-Host '  Phase 2/2 — Inserting examinations' -ForegroundColor Yellow
    Write-Host ''

    $eOk = 0; $eFail = 0
    $examTotal = $patientIds.Count * $ExamsPerPatient
    $examDone  = 0

    foreach ($patId in $patientIds) {
        for ($e = 0; $e -lt $ExamsPerPatient; $e++) {
            $examDone++
            $gestAge = Get-RandomGestationalAge
            $examBody = [PSCustomObject]@{
                patientId                  = $patId
                examDate                   = (Get-RandomExamDate)
                gestationalAge             = $gestAge
                gestationalAgeFromBiometry = $gestAge
                status                     = (Get-RandomItem $examStatuses)
                examinationType            = 'ultrasound_prenatal'
                biometry                   = (Get-RandomBiometry)
                doppler                    = (Get-RandomDoppler)
                findings                   = (Get-RandomItem $examFindings)
                notes                      = (Get-RandomItem $examNotes)
            } | ConvertTo-Json -Depth 4

            try {
                $null = Invoke-RestMethod -Uri "$baseUrl/v1/examinations" `
                    -Method POST -Body $examBody -Headers $authHeaders `
                    -WebSession $webSession -ErrorAction Stop
                $eOk++
            } catch {
                $eFail++
            }

            if ($examDone % 100 -eq 0 -or $examDone -eq $examTotal) {
                $pct = [int](($examDone / $examTotal) * 100)
                $bar = ('█' * [int]($pct / 5)).PadRight(20)
                Write-Host "`r  [$bar] $pct%  ($examDone/$examTotal)  ok=$eOk  fail=$eFail   " -NoNewline -ForegroundColor Cyan
            }
        }
    }

    Write-Host ''
    Write-Host ''
    Write-Host ('╔' + '═' * 60 + '╗') -ForegroundColor Green
    Write-Host ('║' + ("  Done!  Patients: +$pOk  Examinations: +$eOk  (fail=$eFail)").PadRight(60) + '║') -ForegroundColor Green
    Write-Host ('╚' + '═' * 60 + '╝') -ForegroundColor Green
    Write-Host ''

    # ── Reconcile counters from ground truth ──────────────────────────────────
    # The backend's fire-and-forget adjustCounter() calls may have been dropped
    # under load (concurrency retries exhausted, Azurite hiccup, etc.).
    # After a bulk-insert run we do one authoritative scan and write the correct
    # values directly so the dashboard always shows accurate totals.
    Write-Host '  Reconciling counters from ground-truth scan...' -ForegroundColor Yellow
    $truePatients = Get-TrueCount 'Patients'     "PartitionKey eq 'PATIENT' and isDeleted ne true"
    $trueExams    = Get-TrueCount 'Examinations' "PartitionKey eq 'EXAM'    and isDeleted ne true"
    if ($truePatients -eq -1) { $truePatients = 0 }
    if ($trueExams    -eq -1) { $trueExams    = 0 }
    Set-CounterValue 'PATIENT_TOTAL' $truePatients
    Set-CounterValue 'EXAM_TOTAL'    $trueExams
    Write-Host "  PATIENT_TOTAL → $truePatients  |  EXAM_TOTAL → $trueExams" -ForegroundColor Green
    Write-Host ''
}

if ($Mode -eq 'generate-patients') {
    Invoke-GeneratePatients -PatientCount 1000 -ExamsPerPatient 2
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
    $resetExit = $LASTEXITCODE

    # ── Zero counters after a real (non-dry) reset ────────────────────────────
    # reset-patient-data.ps1 hard-deletes all rows but does not touch the
    # PATIENT_TOTAL / EXAM_TOTAL counter rows.  We set them to 0 here so the
    # dashboard immediately reflects the empty state.
    # Dry-run (-WhatIf) makes no deletions, so we skip counter changes for it.
    if ($Mode -ne 'reset-dry' -and $resetExit -eq 0) {
        Write-Host ''
        Write-Host '  Zeroing PATIENT_TOTAL and EXAM_TOTAL counters...' -ForegroundColor Yellow
        try {
            Set-CounterValue 'PATIENT_TOTAL' 0
            Set-CounterValue 'EXAM_TOTAL'    0
            Write-Host '  Counters reset to 0.' -ForegroundColor Green
        } catch {
            Write-Host "  [WARN] Could not zero counters: $_" -ForegroundColor Yellow
            Write-Host '         Run option 7 to check, or option repair-counters to fix.' -ForegroundColor DarkGray
        }
        Write-Host ''
    }

    exit $resetExit
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
