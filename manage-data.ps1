# manage-data.ps1
# Invoke POST /api/v1/auth/register through the SWA Free Tier gateway (port 4280).
#
# Usage:
#   .\manage-data.ps1                             # interactive prompts
#   .\manage-data.ps1 -Username admin `
#                     -Password 'Admin123!@#$' `
#                     -FullName 'System Administrator' `
#                     -Email admin@example.com `
#                     -Role admin
#
#   .\manage-data.ps1 -BaseUrl https://<name>.azurestaticapps.net `
#                     -Token '<admin-jwt>' `
#                     -Username doctor1 ...
#
# Additional commands (require -LoginUsername / -LoginPassword or -Token):
#   -SeedData            Create 1 000 patients each with 2 examinations
#   -CheckCounts         Report counter values vs actual iterated counts
#   -DeleteAll           Delete every non-deleted patient (and cascade examinations)
#   -Snapshot            Dump all Azure Table Storage tables to a JSON file in .\.snapshots\
#                        Requires Azure CLI (az) to be installed and on PATH.
#   -Restore             Upload all entities from a snapshot file back into Azure Table Storage.
#                        Use -SnapshotFile to specify the file; omit to pick from .\.snapshots\.
#                        Requires Azure CLI (az) to be installed and on PATH.
#
# Snapshot examples:
#   .\manage-data.ps1 -Snapshot                             # dev (Azurite)
#   .\manage-data.ps1 -Snapshot -Environment prod `
#                     -ConnectionString 'DefaultEndpointsProtocol=https;...'
#   .\manage-data.ps1 -Snapshot -Environment prod           # reads $env:AZURE_STORAGE_CONNECTION_STRING
#
# Restore examples:
#   .\manage-data.ps1 -Restore                              # picks latest snapshot, dev (Azurite)
#   .\manage-data.ps1 -Restore -SnapshotFile '.\.snapshots\snapshot_prod_20260803_160012.json' `
#                     -Environment prod -ConnectionString 'DefaultEndpointsProtocol=https;...'
#
# Notes:
#   - First user  : no -Token required. The server always assigns role='admin' for the
#                   very first registration regardless of what -Role you supply; you may
#                   pass any valid role or omit -Role and press Enter at the prompt.
#   - Subsequent  : supply an admin JWT via -Token (or leave empty to be prompted).
#                   -Role is mandatory for subsequent users (admin/doctor/viewer).
#   - After success you must POST /api/v1/auth/login to obtain a session.
#   - SeedData / CheckCounts / DeleteAll log in automatically and use cookie-based auth,
#     exactly as a browser would. Supply -LoginUsername and -LoginPassword (or be prompted).

param(
    [string]$BaseUrl       = 'http://localhost:4280',
    [string]$Username      = '',
    [string]$Password      = '',
    [string]$FullName      = '',
    [string]$Email         = '',
    [ValidateSet('admin', 'doctor', 'viewer')]
    [string]$Role          = '',
    # Admin JWT -- required when registering a second or later user.
    # Pass '*' to be prompted interactively.
    [string]$Token         = '',

    # ---- seed / check / delete modes ----
    [switch]$SeedData,
    [switch]$CheckCounts,
    [switch]$DeleteAll,
    # Credentials used to log in before seed / check / delete operations
    [string]$LoginUsername = '',
    [string]$LoginPassword = '',

    # ---- snapshot / restore mode ----
    [switch]$Snapshot,
    [switch]$Restore,
    # Path to the snapshot JSON file to restore from. When omitted with -Restore the script
    # lists available files in .\.snapshots\ and prompts the user to pick one.
    [string]$SnapshotFile = '',
    # Optional explicit connection string. When omitted the script falls back to
    # $env:AZURE_STORAGE_CONNECTION_STRING, then the Azurite explicit string (dev only).
    [string]$ConnectionString = '',
    [ValidateSet('dev', 'prod')]
    [string]$Environment = 'dev'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ==========================================================================
# Shared helpers
# ==========================================================================

function Invoke-Api {
    <#
    .SYNOPSIS
        Thin wrapper around Invoke-RestMethod that carries cookies and surfaces
        the inner error body on failure, mirroring what a browser's fetch() does.
    #>
    param(
        [string]              $Method,
        [string]              $Url,
        [hashtable]           $Headers   = @{},
        [object]              $Body      = $null,
        [Microsoft.PowerShell.Commands.WebRequestSession]
                              $Session   = $null,
        [ref]                 $OutSession = $null
    )

    $irm = @{
        Uri         = $Url
        Method      = $Method
        Headers     = @{ 'Content-Type' = 'application/json' } + $Headers
        ErrorAction = 'Stop'
    }
    if ($Body)       { $irm['Body']            = ($Body | ConvertTo-Json -Depth 10 -Compress) }
    if ($Session)    { $irm['WebSession']       = $Session }
    if ($OutSession) { $irm['SessionVariable']  = '__tmpSession' }

    try {
        if ($OutSession) {
            $result = Invoke-RestMethod @irm
            # SessionVariable stores into a variable in the *caller's* scope via the
            # ref trick below — PowerShell's -SessionVariable needs a plain string name.
            # We capture it via a script-scoped temp then copy it out.
            $OutSession.Value = (Get-Variable '__tmpSession' -ErrorAction SilentlyContinue)?.Value
            return $result
        } else {
            return Invoke-RestMethod @irm
        }
    } catch {
        $httpEx = $_.Exception -as [Microsoft.PowerShell.Commands.HttpResponseException]
        if ($httpEx -and $httpEx.Response) {
            $sc = [int]$httpEx.Response.StatusCode
            $rb = ''
            try {
                $st = $httpEx.Response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
                $rd = [System.IO.StreamReader]::new($st)
                $rb = $rd.ReadToEnd(); $rd.Close()
            } catch {}
            throw [System.Exception]"HTTP $sc -- $rb"
        }
        throw
    }
}

function Get-Session {
    <#
    .SYNOPSIS
        Log in and return a WebRequestSession that carries the session_token cookie,
        exactly as a browser would after a successful login.
    #>
    param([string]$BaseUrl, [string]$User, [string]$Pass)

    $url  = "$($BaseUrl.TrimEnd('/'))/api/v1/auth/login"
    $body = @{ username = $User.ToLower().Trim(); password = $Pass }

    # -SessionVariable stores the cookie jar into $loginSession
    $irm = @{
        Uri             = $url
        Method          = 'POST'
        Headers         = @{ 'Content-Type' = 'application/json' }
        Body            = ($body | ConvertTo-Json -Compress)
        SessionVariable = 'loginSession'
        ErrorAction     = 'Stop'
    }
    try {
        $null = Invoke-RestMethod @irm
    } catch {
        $httpEx = $_.Exception -as [Microsoft.PowerShell.Commands.HttpResponseException]
        if ($httpEx) {
            $sc = [int]$httpEx.Response.StatusCode
            throw [System.Exception]"Login failed HTTP $sc -- check credentials"
        }
        throw [System.Exception]"Login failed -- is SWA CLI running on $BaseUrl ?"
    }

    if (-not $loginSession) {
        throw [System.Exception]'Login did not return a session (no Set-Cookie received)'
    }
    return $loginSession
}

function Invoke-ApiWithSession {
    param(
        [string]              $Method,
        [string]              $Url,
        [object]              $Body    = $null,
        [Microsoft.PowerShell.Commands.WebRequestSession]
                              $Session
    )
    $irm = @{
        Uri         = $Url
        Method      = $Method
        Headers     = @{ 'Content-Type' = 'application/json' }
        WebSession  = $Session
        ErrorAction = 'Stop'
    }
    if ($Body) { $irm['Body'] = ($Body | ConvertTo-Json -Depth 10 -Compress) }

    try {
        return Invoke-RestMethod @irm
    } catch {
        $httpEx = $_.Exception -as [Microsoft.PowerShell.Commands.HttpResponseException]
        if ($httpEx -and $httpEx.Response) {
            $sc = [int]$httpEx.Response.StatusCode
            $rb = ''
            try {
                $st = $httpEx.Response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
                $rd = [System.IO.StreamReader]::new($st)
                $rb = $rd.ReadToEnd(); $rd.Close()
            } catch {}
            throw [System.Exception]"HTTP $sc -- $rb"
        }
        throw
    }
}

# --------------------------------------------------------------------------
# Get all patients (handles continuation-token pagination, pageSize=100)
# --------------------------------------------------------------------------
function Get-AllPatients {
    param(
        [string]              $BaseUrl,
        [Microsoft.PowerShell.Commands.WebRequestSession]
                              $Session
    )
    $all   = [System.Collections.Generic.List[object]]::new()
    $token = $null
    do {
        $qs  = if ($token) { "?pageSize=100&continuationToken=$([uri]::EscapeDataString($token))" } else { '?pageSize=100' }
        $url = "$($BaseUrl.TrimEnd('/'))/api/v1/patients$qs"
        $r   = Invoke-ApiWithSession -Method GET -Url $url -Session $Session
        foreach ($p in $r.data.patients) { $all.Add($p) }
        $token = $r.data.PSObject.Properties['continuationToken']?.Value
    } while ($token)
    return $all
}

# ==========================================================================
# MODE: SeedData  --  create 1 000 patients each with 2 examinations
# ==========================================================================
function Invoke-SeedData {
    param([string]$BaseUrl, [string]$User, [string]$Pass)

    Write-Host ''
    Write-Host '=====================================================' -ForegroundColor Cyan
    Write-Host '   Seed Data -- 1 000 patients x 2 examinations' -ForegroundColor Cyan
    Write-Host "   $BaseUrl" -ForegroundColor DarkGray
    Write-Host '=====================================================' -ForegroundColor Cyan
    Write-Host ''

    $session = Get-Session -BaseUrl $BaseUrl -User $User -Pass $Pass
    Write-Host '  Logged in successfully.' -ForegroundColor Green

    $baseApi     = $BaseUrl.TrimEnd('/')
    $patientUrl  = "$baseApi/api/v1/patients"
    $examUrl     = "$baseApi/api/v1/examinations"

    # Fixed exam date in the past (always valid: examDate <= now)
    $examDate    = (Get-Date).AddDays(-30).ToString('yyyy-MM-dd')

    $pOk = 0; $pFail = 0
    $eOk = 0; $eFail = 0

    for ($i = 1; $i -le 10; $i++) {
        # ---- create patient ----
        $pBody = @{
            name      = "Seed Patient $i"
            phone     = "+1555$('{0:D7}' -f $i)"
            birthDate = '1985-06-15'
            email     = "seed.patient.$i@example.com"
            address   = "123 Seed Street, City $i"
        }
        try {
            $pr         = Invoke-ApiWithSession -Method POST -Url $patientUrl -Body $pBody -Session $session
            $patientId  = $pr.data.patient.patientId
            $pOk++
        } catch {
            $pFail++
            Write-Host "  [WARN] Patient $i failed: $_" -ForegroundColor Yellow
            continue
        }

        # ---- create 2 examinations for the patient ----
        for ($j = 1; $j -le 2; $j++) {
            $eBody = @{
                patientId       = $patientId
                examDate        = $examDate
                status          = 'completed'
                examinationType = 'ultrasound_prenatal'
                gestationalAge  = "20w ${j}d"
                findings        = "Seed examination $j for patient $i. All parameters within normal range."
                notes           = "Auto-generated by manage-data.ps1 -SeedData"
            }
            try {
                $null = Invoke-ApiWithSession -Method POST -Url $examUrl -Body $eBody -Session $session
                $eOk++
            } catch {
                $eFail++
                Write-Host "  [WARN] Exam $j for patient $i (id=$patientId) failed: $_" -ForegroundColor Yellow
            }
        }

        # Progress every 100
        if ($i % 100 -eq 0) {
            Write-Host "  ... $i patients processed (patients ok=$pOk fail=$pFail | exams ok=$eOk fail=$eFail)" -ForegroundColor DarkGray
        }
    }

    Write-Host ''
    Write-Host '=====================================================' -ForegroundColor Green
    Write-Host '   Seed complete' -ForegroundColor Green
    Write-Host '=====================================================' -ForegroundColor Green
    Write-Host "  Patients  : created=$pOk  failed=$pFail" -ForegroundColor White
    Write-Host "  Exams     : created=$eOk  failed=$eFail" -ForegroundColor White
    Write-Host ''
}

# ==========================================================================
# MODE: CheckCounts
#   Reads counter values from the API then iterates all patients to get the
#   real count, and sums up their examinations for a consistency report.
#   Mirrors how the browser dashboard reads /patients-count and /examinations-count.
# ==========================================================================
function Invoke-CheckCounts {
    param([string]$BaseUrl, [string]$User, [string]$Pass)

    Write-Host ''
    Write-Host '=====================================================' -ForegroundColor Cyan
    Write-Host '   Check Counts -- counters vs actual data' -ForegroundColor Cyan
    Write-Host "   $BaseUrl" -ForegroundColor DarkGray
    Write-Host '=====================================================' -ForegroundColor Cyan
    Write-Host ''

    $session = Get-Session -BaseUrl $BaseUrl -User $User -Pass $Pass
    Write-Host '  Logged in successfully.' -ForegroundColor Green

    $baseApi = $BaseUrl.TrimEnd('/')

    # ---- counter values (what the dashboard shows) ----
    $pcResp = Invoke-ApiWithSession -Method GET -Url "$baseApi/api/v1/patients-count"    -Session $session
    $ecResp = Invoke-ApiWithSession -Method GET -Url "$baseApi/api/v1/examinations-count" -Session $session
    $counterPatients = $pcResp.data.count
    $counterExams    = $ecResp.data.count

    Write-Host ''
    Write-Host '  Counter values (what the dashboard reads):' -ForegroundColor Cyan
    Write-Host "    PATIENT_TOTAL  : $counterPatients" -ForegroundColor White
    Write-Host "    EXAM_TOTAL     : $counterExams"    -ForegroundColor White

    # ---- actual counts (what a full table scan would return) ----
    Write-Host ''
    Write-Host '  Iterating all patients (paginated, pageSize=100) ...' -ForegroundColor DarkGray
    $allPatients  = Get-AllPatients -BaseUrl $BaseUrl -Session $session
    $actualPatients = $allPatients.Count

    Write-Host "  Iterating examinations for each patient ..." -ForegroundColor DarkGray
    $actualExams = 0
    foreach ($p in $allPatients) {
        $qs  = "?patient_id=$([uri]::EscapeDataString($p.patientId))&pageSize=100"
        $url = "$baseApi/api/v1/examinations$qs"
        try {
            $er = Invoke-ApiWithSession -Method GET -Url $url -Session $session
            $actualExams += $er.data.examinations.Count
        } catch {
            Write-Host "  [WARN] Could not fetch exams for patient $($p.patientId): $_" -ForegroundColor Yellow
        }
    }

    Write-Host ''
    Write-Host '  Actual counts (from iterating live data):' -ForegroundColor Cyan
    Write-Host "    Patients   : $actualPatients" -ForegroundColor White
    Write-Host "    Examinations: $actualExams"   -ForegroundColor White

    # ---- consistency verdict ----
    Write-Host ''
    Write-Host '  Consistency check:' -ForegroundColor Cyan

    $pMatch = $counterPatients -eq $actualPatients
    $eMatch = $counterExams    -eq $actualExams

    if ($pMatch) {
        Write-Host "    PATIENT_TOTAL  $counterPatients == $actualPatients  OK" -ForegroundColor Green
    } else {
        Write-Host "    PATIENT_TOTAL  counter=$counterPatients  actual=$actualPatients  MISMATCH" -ForegroundColor Red
        Write-Host "    (Counters are non-fatal and updated asynchronously; a small drift is expected" -ForegroundColor DarkGray
        Write-Host "     under concurrent load. Run -CheckCounts again after activity settles.)" -ForegroundColor DarkGray
    }

    if ($eMatch) {
        Write-Host "    EXAM_TOTAL     $counterExams == $actualExams  OK" -ForegroundColor Green
    } else {
        Write-Host "    EXAM_TOTAL     counter=$counterExams  actual=$actualExams  MISMATCH" -ForegroundColor Red
        Write-Host "    (Note: exam count via patient iteration may be incomplete if a patient has" -ForegroundColor DarkGray
        Write-Host "     more than one page of examinations -- increase pageSize above if needed.)" -ForegroundColor DarkGray
    }

    Write-Host ''
}

# ==========================================================================
# MODE: DeleteAll  --  delete every non-deleted patient (cascades exams)
# ==========================================================================
function Invoke-DeleteAll {
    param([string]$BaseUrl, [string]$User, [string]$Pass)

    Write-Host ''
    Write-Host '=====================================================' -ForegroundColor Cyan
    Write-Host '   Delete All Patients (cascade examinations)' -ForegroundColor Cyan
    Write-Host "   $BaseUrl" -ForegroundColor DarkGray
    Write-Host '=====================================================' -ForegroundColor Cyan
    Write-Host ''
    Write-Host '  WARNING: This will soft-delete ALL patients and their examinations.' -ForegroundColor Yellow
    $confirm = Read-Host '  Type YES to confirm'
    if ($confirm -ne 'YES') {
        Write-Host '  Aborted.' -ForegroundColor DarkGray
        return
    }

    $session    = Get-Session -BaseUrl $BaseUrl -User $User -Pass $Pass
    Write-Host '  Logged in successfully.' -ForegroundColor Green

    $baseApi    = $BaseUrl.TrimEnd('/')
    $ok = 0; $fail = 0

    # Repeat pages until none left (each delete removes from the next page result)
    do {
        $batch = Get-AllPatients -BaseUrl $BaseUrl -Session $session
        if ($batch.Count -eq 0) { break }

        Write-Host "  Deleting batch of $($batch.Count) patients ..." -ForegroundColor DarkGray
        foreach ($p in $batch) {
            $url = "$baseApi/api/v1/patients/$($p.patientId)"
            try {
                $null = Invoke-ApiWithSession -Method DELETE -Url $url -Session $session
                $ok++
            } catch {
                $fail++
                Write-Host "  [WARN] Delete $($p.patientId) failed: $_" -ForegroundColor Yellow
            }
        }
    } while ($true)

    Write-Host ''
    Write-Host '=====================================================' -ForegroundColor Green
    Write-Host '   Delete complete' -ForegroundColor Green
    Write-Host '=====================================================' -ForegroundColor Green
    Write-Host "  Deleted : $ok" -ForegroundColor White
    if ($fail -gt 0) {
        Write-Host "  Failed  : $fail" -ForegroundColor Yellow
    }
    Write-Host ''
}


# ==========================================================================
# HELPER: Invoke-TableRestQuery
#   Reads ALL entities from a single Azure Table Storage table via the REST
#   API using a pre-generated SAS token. Bypasses az CLI which corrupts
#   string values containing 'w'/'d' via OData type annotation confusion.
#   Handles x-ms-continuation pagination via a HttpWebRequest so we can
#   read response headers (Invoke-RestMethod swallows them in PS 5/6).
# ==========================================================================
function Invoke-TableRestQuery {
    param(
        [string]$TableEndpoint,   # e.g. http://127.0.0.1:10002/devstoreaccount1
        [string]$TableName,
        [string]$SasToken
    )

    $all    = [System.Collections.Generic.List[object]]::new()
    $nextPK = $null
    $nextRK = $null

    do {
        $url = "${TableEndpoint}/${TableName}()?${SasToken}"
        if ($nextPK) {
            $url += '&NextPartitionKey=' + [uri]::EscapeDataString($nextPK) +
                    '&NextRowKey='       + [uri]::EscapeDataString($nextRK)
        }

        # Use HttpWebRequest to access response headers for continuation tokens
        $req = [System.Net.HttpWebRequest]::Create($url)
        $req.Method  = 'GET'
        $req.Accept  = 'application/json;odata=nometadata'
        $req.Headers['x-ms-version'] = '2020-12-06'

        try {
            $resp    = $req.GetResponse()
            $reader  = [System.IO.StreamReader]::new($resp.GetResponseStream())
            $body    = $reader.ReadToEnd()
            $reader.Close()

            $nextPK = $resp.Headers['x-ms-continuation-NextPartitionKey']
            $nextRK = $resp.Headers['x-ms-continuation-NextRowKey']
            $resp.Close()
        } catch [System.Net.WebException] {
            $sc      = [int]$_.Exception.Response.StatusCode
            $errBody = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()).ReadToEnd()
            throw "REST query failed HTTP $sc (table=$TableName): $errBody"
        }

        $page = $body | ConvertFrom-Json
        foreach ($item in $page.value) {
            $all.Add($item)
        }
    } while ($nextPK)

    return $all
}

# ==========================================================================
# MODE: Snapshot  --  dump all tables to .\.snapshots\snapshot_{env}_{ts}.json
#   Uses Azure Table Storage REST API directly (via SAS token) to dump all
#   entities with exact field values — az CLI is only used once to generate
#   the SAS token, not for reading data.
#   Connection string resolution order:
#     1. -ConnectionString param
#     2. $env:AZURE_STORAGE_CONNECTION_STRING
#     3. Azurite explicit string  (dev only; prod throws if neither set)
# ==========================================================================
function Invoke-Snapshot {
    param(
        [string]$Environment      = 'dev',
        [string]$ConnectionString = ''
    )

    Write-Host ''
    Write-Host '=====================================================' -ForegroundColor Cyan
    Write-Host '   DB Snapshot -- Azure Table Storage' -ForegroundColor Cyan
    Write-Host "   Environment : $Environment" -ForegroundColor DarkGray
    Write-Host '=====================================================' -ForegroundColor Cyan
    Write-Host ''

    # ---- validate az CLI is available ----
    if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
        throw 'Azure CLI (az) not found on PATH. Install from https://aka.ms/installazurecliwindows'
    }

    # ---- resolve connection string ----
    # NOTE: 'UseDevelopmentStorage=true' is an SDK shorthand that the Azure CLI does NOT
    # support. For Azurite (dev) we always expand it to the full explicit connection string
    # that az CLI can parse (AccountName=devstoreaccount1, HTTP, 127.0.0.1 endpoints).
    $azuriteConnStr = 'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;' +
                      'AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;' +
                      'TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;'

    $connStr = ''
    if ($ConnectionString) {
        $connStr = $ConnectionString
        Write-Host '  Using connection string from -ConnectionString param.' -ForegroundColor DarkGray
    } elseif ($env:AZURE_STORAGE_CONNECTION_STRING -and
              $env:AZURE_STORAGE_CONNECTION_STRING -ne 'UseDevelopmentStorage=true') {
        $connStr = $env:AZURE_STORAGE_CONNECTION_STRING
        Write-Host '  Using connection string from $env:AZURE_STORAGE_CONNECTION_STRING.' -ForegroundColor DarkGray
    } elseif ($Environment -eq 'dev') {
        $connStr = $azuriteConnStr
        Write-Host '  Using local Azurite (127.0.0.1:10002).' -ForegroundColor DarkGray
    } else {
        throw "prod snapshot requires -ConnectionString or `$env:AZURE_STORAGE_CONNECTION_STRING to be set."
    }

    # ---- extract table endpoint and generate SAS token ----
    $tableEndpoint = ''
    foreach ($part in $connStr -split ';') {
        if ($part -match '^TableEndpoint=(.+)$') { $tableEndpoint = $Matches[1].TrimEnd('/'); break }
    }
    if (-not $tableEndpoint) {
        foreach ($part in $connStr -split ';') {
            if ($part -match '^AccountName=(.+)$') {
                $proto         = if ($connStr -match 'DefaultEndpointsProtocol=https') { 'https' } else { 'http' }
                $tableEndpoint = "${proto}://$($Matches[1]).table.core.windows.net"
                break
            }
        }
    }
    if (-not $tableEndpoint) { throw "Cannot determine Table endpoint from connection string." }

    Write-Host '  Generating SAS token ...' -ForegroundColor DarkGray
    $sasToken = Get-TableSasToken -ConnStr $connStr -Permissions 'rl'
    Write-Host '  SAS token obtained.' -ForegroundColor DarkGray
    Write-Host ''

    # ---- prepare output file ----
    $outDir = Join-Path $PSScriptRoot '.snapshots'
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    $ts      = Get-Date -Format 'yyyyMMdd_HHmmss'
    $outFile = Join-Path $outDir "snapshot_${Environment}_${ts}.json"

    Write-Host "  Output : $outFile" -ForegroundColor DarkGray
    Write-Host ''

    # ---- dump each table ----
    $tables = @('Users', 'Patients', 'Examinations', 'Counters', 'AuditLogs')
    $counts = @{}
    $data   = [ordered]@{}

    foreach ($table in $tables) {
        Write-Host "  Dumping $table ..." -ForegroundColor DarkGray -NoNewline
        try {
            $entities       = Invoke-TableRestQuery -TableEndpoint $tableEndpoint -TableName $table -SasToken $sasToken
            $counts[$table] = $entities.Count
            $data[$table]   = $entities
            Write-Host "  $($entities.Count) entities" -ForegroundColor White
        } catch {
            Write-Host '' # end the -NoNewline line
            throw "Failed to dump table '$table': $_"
        }
    }

    # ---- build snapshot document ----
    $snapshot = [ordered]@{
        snapshotMeta = [ordered]@{
            createdAt   = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
            environment = $Environment
            tables      = $tables
        }
    }
    foreach ($table in $tables) {
        $snapshot[$table] = $data[$table]
    }

    # ---- serialise and write ----
    $snapshot | ConvertTo-Json -Depth 20 -Compress | Set-Content -Path $outFile -Encoding UTF8

    # ---- success banner ----
    Write-Host ''
    Write-Host '=====================================================' -ForegroundColor Green
    Write-Host '   Snapshot complete' -ForegroundColor Green
    Write-Host '=====================================================' -ForegroundColor Green
    foreach ($table in $tables) {
        Write-Host ("  {0,-14}: {1} entities" -f $table, $counts[$table]) -ForegroundColor White
    }
    Write-Host ''
    Write-Host "  File: $(Resolve-Path $outFile)" -ForegroundColor Cyan
    Write-Host ''
}


# ==========================================================================
# HELPER: Get-TableSasToken
#   Uses az storage account generate-sas to produce a short-lived account SAS
#   token scoped to Table service (rwdlau). Returns the raw query-string token
#   (without leading '?'). Called once per Invoke-Restore run.
# ==========================================================================

# Fields returned by az storage entity query that must NOT be written back
$script:AzReadOnlyFields = @('Timestamp', 'etag', 'odata.etag', 'odata.metadata')

function Get-TableSasToken {
    param(
        [string]$ConnStr,
        [string]$Permissions = 'rwdlau',   # rwdlau = read+write+delete+list+add+update
        [int]   $ExpiryHours = 2
    )

    $expiry = (Get-Date).AddHours($ExpiryHours).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

    $stdoutFile = [System.IO.Path]::GetTempFileName()
    $stderrFile = [System.IO.Path]::GetTempFileName()
    try {
        $proc = Start-Process -FilePath 'az' -ArgumentList @(
            'storage', 'account', 'generate-sas',
            '--connection-string', $ConnStr,
            '--services',          't',
            '--resource-types',    'sco',
            '--permissions',       $Permissions,
            '--expiry',            $expiry,
            '--output',            'tsv'
        ) -RedirectStandardOutput $stdoutFile `
          -RedirectStandardError  $stderrFile `
          -NoNewWindow -Wait -PassThru

        $sas    = ((Get-Content -Path $stdoutFile -Raw -Encoding UTF8) -join '').Trim()
        $sasErr = ((Get-Content -Path $stderrFile -Raw -Encoding UTF8) -join '').Trim()

        if ($proc.ExitCode -ne 0) {
            throw "az storage account generate-sas failed: $sasErr"
        }
        if (-not $sas) {
            throw "az storage account generate-sas returned empty token. stderr: $sasErr"
        }
        return $sas
    } finally {
        Remove-Item $stdoutFile, $stderrFile -ErrorAction SilentlyContinue
    }
}

# ==========================================================================
# HELPER: Invoke-TableEntityUpsert
#   INSERT OR REPLACE a single entity via the Azure Table Storage REST API
#   using a pre-generated SAS token. No per-call subprocess — pure HTTP.
#   Azure read-only metadata (Timestamp, etag, odata.etag) are stripped.
#   Upsert strategy: PUT without If-Match (insert); on 409 Conflict retry
#   with If-Match: * (replace). This is a true insert-or-replace.
# ==========================================================================
function Invoke-TableEntityUpsert {
    param(
        [string]$TableEndpoint,   # e.g. http://127.0.0.1:10002/devstoreaccount1
        [string]$TableName,
        [string]$SasToken,        # raw query-string SAS (no leading '?')
        [object]$Entity
    )

    # Build clean payload: strip read-only fields and nulls
    $clean = [ordered]@{}
    foreach ($prop in $Entity.PSObject.Properties) {
        if ($prop.Name -in $script:AzReadOnlyFields) { continue }
        if ($null -eq $prop.Value)                   { continue }
        $clean[$prop.Name] = $prop.Value
    }

    $pk   = $clean['PartitionKey']
    $rk   = $clean['RowKey']
    $body = $clean | ConvertTo-Json -Depth 10 -Compress

    # URL: <endpoint>/<table>(PartitionKey='<pk>',RowKey='<rk>')?<sas>
    $pkEnc = [uri]::EscapeDataString($pk)
    $rkEnc = [uri]::EscapeDataString($rk)
    $url   = "${TableEndpoint}/${TableName}(PartitionKey='${pkEnc}',RowKey='${rkEnc}')?${SasToken}"

    $headers = @{
        'Content-Type' = 'application/json'
        'Accept'       = 'application/json;odata=nometadata'
    }

    # Try insert (PUT, no If-Match)
    try {
        $null = Invoke-RestMethod -Uri $url -Method PUT -Headers $headers -Body $body -ErrorAction Stop
        return  # success
    } catch {
        $sc = $_.Exception.Response.StatusCode.value__
        if ($sc -ne 409) {
            # Unexpected error — surface it
            try {
                $stream  = $_.Exception.Response.GetResponseStream()
                $errBody = [System.IO.StreamReader]::new($stream).ReadToEnd()
            } catch { $errBody = $_.ToString() }
            throw "REST PUT insert failed HTTP $sc (table=$TableName PK=$pk RK=$rk): $errBody"
        }
        # 409 Conflict = entity already exists — fall through to replace
    }

    # Replace existing entity (PUT, If-Match: *)
    $headers2 = $headers + @{ 'If-Match' = '*' }
    try {
        $null = Invoke-RestMethod -Uri $url -Method PUT -Headers $headers2 -Body $body -ErrorAction Stop
    } catch {
        $sc = $_.Exception.Response.StatusCode.value__
        try {
            $stream  = $_.Exception.Response.GetResponseStream()
            $errBody = [System.IO.StreamReader]::new($stream).ReadToEnd()
        } catch { $errBody = $_.ToString() }
        throw "REST PUT replace failed HTTP $sc (table=$TableName PK=$pk RK=$rk): $errBody"
    }
}

# ==========================================================================
# MODE: Restore  --  upload all entities from a snapshot JSON file back into
#   Azure Table Storage. Upserts every row (insert-or-replace) so it is safe
#   to run against a non-empty storage — existing rows are overwritten.
#   Connection string resolution is identical to Invoke-Snapshot.
# ==========================================================================
function Invoke-Restore {
    param(
        [string]$Environment      = 'dev',
        [string]$ConnectionString = '',
        [string]$SnapshotFile     = ''
    )

    Write-Host ''
    Write-Host '=====================================================' -ForegroundColor Cyan
    Write-Host '   DB Restore -- Azure Table Storage' -ForegroundColor Cyan
    Write-Host "   Environment : $Environment" -ForegroundColor DarkGray
    Write-Host '=====================================================' -ForegroundColor Cyan
    Write-Host ''

    # ---- validate az CLI is available ----
    if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
        throw 'Azure CLI (az) not found on PATH. Install from https://aka.ms/installazurecliwindows'
    }

    # ---- resolve connection string (same logic as Invoke-Snapshot) ----
    $azuriteConnStr = 'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;' +
                      'AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;' +
                      'TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;'

    $connStr = ''
    if ($ConnectionString) {
        $connStr = $ConnectionString
        Write-Host '  Using connection string from -ConnectionString param.' -ForegroundColor DarkGray
    } elseif ($env:AZURE_STORAGE_CONNECTION_STRING -and
              $env:AZURE_STORAGE_CONNECTION_STRING -ne 'UseDevelopmentStorage=true') {
        $connStr = $env:AZURE_STORAGE_CONNECTION_STRING
        Write-Host '  Using connection string from $env:AZURE_STORAGE_CONNECTION_STRING.' -ForegroundColor DarkGray
    } elseif ($Environment -eq 'dev') {
        $connStr = $azuriteConnStr
        Write-Host '  Using local Azurite (127.0.0.1:10002).' -ForegroundColor DarkGray
    } else {
        throw "prod restore requires -ConnectionString or `$env:AZURE_STORAGE_CONNECTION_STRING to be set."
    }

    # ---- extract table endpoint from connection string ----
    # Parses TableEndpoint=... from explicit conn strings, or derives the
    # default Azure endpoint from AccountName= for prod connection strings.
    $tableEndpoint = ''
    foreach ($part in $connStr -split ';') {
        if ($part -match '^TableEndpoint=(.+)$') {
            $tableEndpoint = $Matches[1].TrimEnd('/')
            break
        }
    }
    if (-not $tableEndpoint) {
        # Derive from AccountName for prod (https://account.table.core.windows.net)
        foreach ($part in $connStr -split ';') {
            if ($part -match '^AccountName=(.+)$') {
                $acctName      = $Matches[1]
                $proto         = if ($connStr -match 'DefaultEndpointsProtocol=https') { 'https' } else { 'http' }
                $tableEndpoint = "${proto}://${acctName}.table.core.windows.net"
                break
            }
        }
    }
    if (-not $tableEndpoint) {
        throw "Cannot determine Table endpoint from connection string."
    }

    # ---- obtain a short-lived SAS token for REST upserts ----
    Write-Host '  Generating SAS token ...' -ForegroundColor DarkGray
    $sasToken = Get-TableSasToken -ConnStr $connStr
    Write-Host '  SAS token obtained.' -ForegroundColor DarkGray
    Write-Host ''

    # ---- resolve snapshot file ----
    if (-not $SnapshotFile) {
        $snapshotDir = Join-Path $PSScriptRoot '.snapshots'
        if (-not (Test-Path $snapshotDir)) {
            throw "No .snapshots directory found at '$snapshotDir'. Run -Snapshot first or supply -SnapshotFile."
        }
        $files = @(Get-ChildItem -Path $snapshotDir -Filter 'snapshot_*.json' |
                   Sort-Object LastWriteTime -Descending)
        if ($files.Count -eq 0) {
            throw "No snapshot files found in '$snapshotDir'. Run -Snapshot first or supply -SnapshotFile."
        }
        if ($files.Count -eq 1) {
            $SnapshotFile = $files[0].FullName
            Write-Host "  Auto-selected snapshot: $SnapshotFile" -ForegroundColor DarkGray
        } else {
            Write-Host '  Available snapshots (most recent first):' -ForegroundColor Cyan
            for ($i = 0; $i -lt [Math]::Min($files.Count, 10); $i++) {
                Write-Host ("    {0}  {1}" -f ($i + 1), $files[$i].Name) -ForegroundColor White
            }
            Write-Host ''
            $pick = Read-Host "  Enter number (1-$([Math]::Min($files.Count, 10)))"
            $idx  = [int]$pick - 1
            if ($idx -lt 0 -or $idx -ge $files.Count) {
                throw "Invalid selection '$pick'."
            }
            $SnapshotFile = $files[$idx].FullName
        }
    }

    if (-not (Test-Path $SnapshotFile)) {
        throw "Snapshot file not found: '$SnapshotFile'"
    }

    Write-Host "  Source : $SnapshotFile" -ForegroundColor DarkGray
    Write-Host ''

    # ---- load snapshot ----
    Write-Host '  Loading snapshot ...' -ForegroundColor DarkGray
    $snapshot = Get-Content -Path $SnapshotFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $meta     = $snapshot.snapshotMeta
    Write-Host "  Created : $($meta.createdAt)  (env=$($meta.environment))" -ForegroundColor DarkGray
    Write-Host ''

    # ---- safety confirmation ----
    Write-Host '  WARNING: This will INSERT OR REPLACE every entity from the snapshot.' -ForegroundColor Yellow
    Write-Host '           Existing rows with matching PartitionKey+RowKey will be overwritten.' -ForegroundColor Yellow
    $confirm = Read-Host '  Type YES to confirm'
    if ($confirm -ne 'YES') {
        Write-Host '  Aborted.' -ForegroundColor DarkGray
        return
    }
    Write-Host ''

    # ---- restore each table ----
    $tables = $meta.tables
    $counts = @{}

    foreach ($table in $tables) {
        $entities = $snapshot.$table
        if ($null -eq $entities) {
            Write-Host "  [SKIP] Table '$table' not found in snapshot." -ForegroundColor DarkGray
            continue
        }

        $total = $entities.Count
        $ok    = 0
        $fail  = 0

        Write-Host "  Restoring $table ($total entities) ..." -ForegroundColor DarkGray

        foreach ($entity in $entities) {
            try {
                Invoke-TableEntityUpsert -TableEndpoint $tableEndpoint -TableName $table -SasToken $sasToken -Entity $entity
                $ok++
            } catch {
                $fail++
                Write-Host "  [WARN] $_" -ForegroundColor Yellow
            }

            # Progress every 100
            if (($ok + $fail) % 100 -eq 0) {
                Write-Host "    ... $($ok + $fail) / $total (ok=$ok fail=$fail)" -ForegroundColor DarkGray
            }
        }

        $counts[$table] = [ordered]@{ ok = $ok; fail = $fail }
        $color = if ($fail -gt 0) { 'Yellow' } else { 'White' }
        Write-Host ("    {0,-14}: ok={1}  fail={2}" -f $table, $ok, $fail) -ForegroundColor $color
    }

    # ---- summary banner ----
    Write-Host ''
    Write-Host '=====================================================' -ForegroundColor Green
    Write-Host '   Restore complete' -ForegroundColor Green
    Write-Host '=====================================================' -ForegroundColor Green
    foreach ($table in $tables) {
        if ($counts.ContainsKey($table)) {
            $c = $counts[$table]
            $color = if ($c.fail -gt 0) { 'Yellow' } else { 'White' }
            Write-Host ("  {0,-14}: ok={1}  fail={2}" -f $table, $c.ok, $c.fail) -ForegroundColor $color
        }
    }
    Write-Host ''
}



# ==========================================================================
# DISPATCH  --  interactive menu when no action parameter is supplied
# ==========================================================================

$hasActionParam = $SeedData -or $CheckCounts -or $DeleteAll -or $Snapshot -or $Restore `
               -or $Username -or $Password -or $Email -or $Token

if (-not $hasActionParam) {
    Write-Host ''
    Write-Host '=====================================================' -ForegroundColor Cyan
    Write-Host '   manage-data.ps1  --  SWA Free Tier' -ForegroundColor Cyan
    Write-Host "   $BaseUrl" -ForegroundColor DarkGray
    Write-Host '=====================================================' -ForegroundColor Cyan
    Write-Host ''
    Write-Host '  1  Register a new user' -ForegroundColor White
    Write-Host '  2  Seed 10 patients x 2 examinations' -ForegroundColor White
    Write-Host '  3  Check patient / examination counts' -ForegroundColor White
    Write-Host '  4  Delete ALL patients (cascade examinations)' -ForegroundColor White
    Write-Host '  5  Create DB snapshot to local disk' -ForegroundColor White
    Write-Host '  6  Restore DB from snapshot file' -ForegroundColor White
    Write-Host '  Q  Quit' -ForegroundColor DarkGray
    Write-Host ''

    $choice = Read-Host '  Select option'

    switch ($choice.Trim().ToUpper()) {
        '1' { <# fall through to registration block below #> }
        '2' {
            if (-not $LoginUsername) { $LoginUsername = Read-Host '  Username for login' }
            if (-not $LoginPassword) { $LoginPassword = Read-Host '  Password for login' }
            Invoke-SeedData -BaseUrl $BaseUrl -User $LoginUsername -Pass $LoginPassword
            exit 0
        }
        '3' {
            if (-not $LoginUsername) { $LoginUsername = Read-Host '  Username for login' }
            if (-not $LoginPassword) { $LoginPassword = Read-Host '  Password for login' }
            Invoke-CheckCounts -BaseUrl $BaseUrl -User $LoginUsername -Pass $LoginPassword
            exit 0
        }
        '4' {
            if (-not $LoginUsername) { $LoginUsername = Read-Host '  Username for login' }
            if (-not $LoginPassword) { $LoginPassword = Read-Host '  Password for login' }
            Invoke-DeleteAll -BaseUrl $BaseUrl -User $LoginUsername -Pass $LoginPassword
            exit 0
        }
        '5' {
            Invoke-Snapshot -Environment $Environment -ConnectionString $ConnectionString
            exit 0
        }
        '6' {
            Invoke-Restore -Environment $Environment -ConnectionString $ConnectionString -SnapshotFile $SnapshotFile
            exit 0
        }
        'Q' { Write-Host '  Bye.' -ForegroundColor DarkGray; exit 0 }
        default {
            Write-Host "  Unknown option '$choice'. Exiting." -ForegroundColor Red
            exit 1
        }
    }
}

# Switch-based explicit invocation (non-interactive)
if ($SeedData -or $CheckCounts -or $DeleteAll -or $Snapshot -or $Restore) {
    if ($Snapshot) {
        Invoke-Snapshot -Environment $Environment -ConnectionString $ConnectionString
        exit 0
    }
    if ($Restore) {
        Invoke-Restore -Environment $Environment -ConnectionString $ConnectionString -SnapshotFile $SnapshotFile
        exit 0
    }

    if (-not $LoginUsername) { $LoginUsername = Read-Host '  Username for login' }
    if (-not $LoginPassword) { $LoginPassword = Read-Host '  Password for login' }

    if ($SeedData)    { Invoke-SeedData    -BaseUrl $BaseUrl -User $LoginUsername -Pass $LoginPassword }
    if ($CheckCounts) { Invoke-CheckCounts -BaseUrl $BaseUrl -User $LoginUsername -Pass $LoginPassword }
    if ($DeleteAll)   { Invoke-DeleteAll   -BaseUrl $BaseUrl -User $LoginUsername -Pass $LoginPassword }
    exit 0
}

# ==========================================================================
# REGISTRATION  (menu option 1, or explicit -Username / -Password / etc.)
# ==========================================================================

Write-Host ''
Write-Host '=====================================================' -ForegroundColor Cyan
Write-Host '   Register User -- SWA Free Tier' -ForegroundColor Cyan
Write-Host "   $BaseUrl" -ForegroundColor DarkGray
Write-Host '=====================================================' -ForegroundColor Cyan
Write-Host ''

# --------------------------------------------------------------------------
if (-not $Username) { $Username = Read-Host '  Username (3-50 chars, letters/numbers/_/-)' }
if (-not $Password) { $Password = Read-Host '  Password (min 12 chars)' }
if (-not $FullName) { $FullName = Read-Host '  Full name (optional, press Enter to skip)' }
if (-not $Email)    { $Email    = Read-Host '  Email' }
if (-not $Role) {
    # Role is optional for the first user (server always forces 'admin').
    # For subsequent users a valid role is required by the server.
    # Use a plain variable (no ValidateSet) so an empty Enter is accepted.
    $roleInput = Read-Host '  Role [admin / doctor / viewer]  (first-user: press Enter to skip)'
    if ($roleInput) { $Role = $roleInput }
}

# --------------------------------------------------------------------------
$body = [ordered]@{
    username = $Username
    password = $Password
    email    = $Email
}
# Include role only when the caller provided one.
# For first-user bootstrap, omitting role is valid -- the server forces 'admin'.
# For subsequent users, a non-empty role will be included; the server validates it.
if ($Role) { $body['role'] = $Role }
if ($FullName) { $body['fullName'] = $FullName }

$json = $body | ConvertTo-Json

# --------------------------------------------------------------------------
$headers = @{ 'Content-Type' = 'application/json' }

if ($Token -eq '*') {
    $Token = Read-Host '  Admin JWT (paste token, or press Enter if first user)'
}
if ($Token) {
    $headers['Authorization'] = "Bearer $Token"
}

# --------------------------------------------------------------------------
$url = "$($BaseUrl.TrimEnd('/'))/api/v1/auth/register"

Write-Host "  POST $url" -ForegroundColor DarkGray
Write-Host ''

try {
    $response = Invoke-RestMethod `
        -Uri         $url `
        -Method      POST `
        -Headers     $headers `
        -Body        $json `
        -ErrorAction Stop

    # successResponse envelope: { success: true, data: { message, user } }
    $user = $response.data.user

    Write-Host '=====================================================' -ForegroundColor Green
    Write-Host '   User registered successfully' -ForegroundColor Green
    Write-Host '=====================================================' -ForegroundColor Green
    Write-Host ''
    Write-Host "  id        : $($user.id)"         -ForegroundColor White
    Write-Host "  username  : $($user.username)"   -ForegroundColor White
    Write-Host "  full_name : $($user.full_name)"  -ForegroundColor White
    Write-Host "  email     : $($user.email)"      -ForegroundColor White
    Write-Host "  role      : $($user.role)"       -ForegroundColor Yellow
    Write-Host ''
    Write-Host '  NOTE: No session was issued. Log in to obtain a session:' -ForegroundColor DarkGray
    Write-Host "     POST $($BaseUrl.TrimEnd('/'))/api/v1/auth/login" -ForegroundColor Cyan
    Write-Host ''

} catch {
    $err          = $_
    $statusCode   = $null
    $responseBody = ''

    $httpEx = $err.Exception -as [Microsoft.PowerShell.Commands.HttpResponseException]
    if ($httpEx -and $httpEx.Response) {
        $statusCode = [int]$httpEx.Response.StatusCode

        try {
            $stream = $httpEx.Response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
            $reader = [System.IO.StreamReader]::new($stream)
            $responseBody = $reader.ReadToEnd()
            $reader.Close()
        } catch { <# ignore secondary read failure #> }
    }

    Write-Host '=====================================================' -ForegroundColor Red
    Write-Host '   Registration failed' -ForegroundColor Red
    Write-Host '=====================================================' -ForegroundColor Red
    Write-Host ''

    switch ($statusCode) {
        400 { Write-Host '  HTTP 400 -- Validation error' -ForegroundColor Red }
        401 { Write-Host '  HTTP 401 -- Admin JWT required (not the first user)' -ForegroundColor Red }
        403 { Write-Host '  HTTP 403 -- Admin role required' -ForegroundColor Red }
        409 { Write-Host '  HTTP 409 -- Username already exists' -ForegroundColor Yellow }
        503 { Write-Host '  HTTP 503 -- Storage temporarily unavailable; retry in a moment' -ForegroundColor Yellow }
        default {
            if ($statusCode) {
                Write-Host "  HTTP $statusCode -- $($err.Exception.Message)" -ForegroundColor Red
            } else {
                Write-Host "  Network error -- is SWA CLI running on $BaseUrl ?" -ForegroundColor Red
                Write-Host '  Start it with: swa start --config swa-cli.config.json' -ForegroundColor DarkGray
            }
        }
    }

    if ($responseBody) {
        Write-Host ''
        Write-Host '  Response body:' -ForegroundColor DarkGray
        try {
            $responseBody | ConvertFrom-Json | ConvertTo-Json -Depth 4 | Write-Host -ForegroundColor White
        } catch {
            Write-Host "  $responseBody" -ForegroundColor White
        }
    }

    Write-Host ''
    exit 1
}

# Made with Bob
