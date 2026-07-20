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
    [string]$LoginPassword = ''
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
# DISPATCH  --  interactive menu when no action parameter is supplied
# ==========================================================================

$hasActionParam = $SeedData -or $CheckCounts -or $DeleteAll `
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
        'Q' { Write-Host '  Bye.' -ForegroundColor DarkGray; exit 0 }
        default {
            Write-Host "  Unknown option '$choice'. Exiting." -ForegroundColor Red
            exit 1
        }
    }
}

# Switch-based explicit invocation (non-interactive)
if ($SeedData -or $CheckCounts -or $DeleteAll) {
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
