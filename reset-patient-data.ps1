<#
.SYNOPSIS
    Resets patient and examination data from Azure Table Storage (Azurite dev or real account).

.DESCRIPTION
    Performs a cascading hard-delete of all entities across the following partitions, in
    dependency order so that no child record outlives its parent:

        Deletion order (child to parent):
          1. Examinations  - MRN lookup rows          (PartitionKey = "MRN")
          2. Examinations  - EXAM lookup rows          (PartitionKey = "EXAM")
          3. Examinations  - timeline rows per patient (PartitionKey starts with "PATIENT_")
          4. Counters      - MRN year counters         (PartitionKey = "COUNTER", RowKey starts with "MRN_")
          5. Patients      - search index rows         (PartitionKey starts with "PATIENT_SEARCH_")
          6. Patients      - primary patient rows      (PartitionKey = "PATIENT")
          7. Patients      - legacy MRN lookup rows    (PartitionKey = "MRN")  [retired partition]

    AuditLogs are intentionally preserved (immutable compliance trail).

    A simulated "transaction" is used: all entities to delete are collected first,
    then deleted in the order above. If any deletion batch fails the script stops
    and reports which step failed and how many rows were successfully removed before
    the failure - manual rollback guidance is printed.

.PARAMETER WhatIf
    Enumerate and print what would be deleted without touching the storage account.

.PARAMETER Force
    Skip the interactive confirmation prompt.

.PARAMETER ConnectionString
    Azure Storage connection string. Defaults to the Azurite development string
    "UseDevelopmentStorage=true".

.EXAMPLE
    .\reset-patient-data.ps1 -WhatIf
    .\reset-patient-data.ps1 -Force
    .\reset-patient-data.ps1 -ConnectionString "DefaultEndpointsProtocol=https;AccountName=..."
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [switch]$Force,
    [string]$ConnectionString = 'UseDevelopmentStorage=true'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ── Colour helpers ────────────────────────────────────────────────────────────
function Write-Step   { param([string]$Msg) Write-Host "  >> $Msg" -ForegroundColor Cyan }
function Write-Ok     { param([string]$Msg) Write-Host "  [OK] $Msg" -ForegroundColor Green }
function Write-Warn   { param([string]$Msg) Write-Host "  [WARN] $Msg" -ForegroundColor Yellow }
function Write-Fail   { param([string]$Msg) Write-Host "  [FAIL] $Msg" -ForegroundColor Red }
function Write-Info   { param([string]$Msg) Write-Host "       $Msg" -ForegroundColor Gray }

# ── Connection string parser ──────────────────────────────────────────────────
function Parse-ConnectionString {
    param([string]$cs)

    # Development storage shorthand
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
        if ($idx -gt 0) {
            $k = $segment.Substring(0, $idx).Trim()
            $v = $segment.Substring($idx + 1).Trim()
            $parts[$k] = $v
        }
    }

    $name = $parts['AccountName']
    $key  = $parts['AccountKey']

    # Determine Table endpoint
    if ($parts.ContainsKey('TableEndpoint')) {
        $tableEndpoint = $parts['TableEndpoint'].TrimEnd('/')
    } elseif ($parts.ContainsKey('EndpointSuffix')) {
        $proto = if ($parts['DefaultEndpointsProtocol']) { $parts['DefaultEndpointsProtocol'] } else { 'https' }
        $tableEndpoint = "${proto}://${name}.table.$($parts['EndpointSuffix'])"
    } else {
        $proto = if ($parts['DefaultEndpointsProtocol']) { $parts['DefaultEndpointsProtocol'] } else { 'https' }
        $tableEndpoint = "${proto}://${name}.table.core.windows.net"
    }

    return @{
        AccountName   = $name
        AccountKey    = $key
        TableEndpoint = $tableEndpoint
    }
}

# ── HMAC-SHA256 signature (Azure Shared Key Lite for Table) ───────────────────
function New-SharedKeyLiteHeader {
    param(
        [string]$AccountName,
        [string]$AccountKey,    # base-64 encoded
        [string]$Method,
        [string]$Date,
        [string]$CanonicalizedResource  # e.g. "/devstoreaccount1/MyTable()"
    )

    $keyBytes     = [Convert]::FromBase64String($AccountKey)
    $hmac         = [System.Security.Cryptography.HMACSHA256]::new($keyBytes)
    $stringToSign = "$Date`n$CanonicalizedResource"
    $sigBytes     = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($stringToSign))
    $signature    = [Convert]::ToBase64String($sigBytes)
    $hmac.Dispose()
    return "SharedKeyLite ${AccountName}:${signature}"
}

# ── HTTP helper: single Azure Table Storage REST call ─────────────────────────
function Invoke-TableRequest {
    param(
        [string]$Method,
        [string]$Uri,
        [string]$AccountName,
        [string]$AccountKey,
        [string]$TableEndpoint,
        [hashtable]$ExtraHeaders = @{}
    )

    $date = [DateTime]::UtcNow.ToString('R')   # RFC 1123 e.g. "Mon, 06 Jan 2020 ..."

    # Canonicalized resource: strip scheme+host from Uri, keep path+query
    $uriObj     = [Uri]$Uri
    $canonPath  = $uriObj.AbsolutePath    # already URL-encoded
    $canonical  = "/$AccountName$canonPath"

    $auth = New-SharedKeyLiteHeader `
        -AccountName          $AccountName `
        -AccountKey           $AccountKey `
        -Method               $Method `
        -Date                 $date `
        -CanonicalizedResource $canonical

    $headers = @{
        'Authorization'      = $auth
        'x-ms-date'          = $date
        'x-ms-version'       = '2020-12-06'
        'Accept'             = 'application/json;odata=nometadata'
        'DataServiceVersion' = '3.0;NetFx'
    }
    foreach ($k in $ExtraHeaders.Keys) { $headers[$k] = $ExtraHeaders[$k] }

    try {
        $response = Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers -ErrorAction Stop
        return $response
    } catch {
        $sc = $_.Exception.Response.StatusCode.value__
        # 404 on DELETE = already gone — treat as success
        if ($Method -eq 'DELETE' -and $sc -eq 404) { return $null }
        throw
    }
}

# ── List all entities in a table (full scan with continuation token) ──────────
function Get-AllEntities {
    param(
        [string]$TableName,
        [string]$Filter,       # OData $filter string (optional)
        [string]$AccountName,
        [string]$AccountKey,
        [string]$TableEndpoint
    )

    $entities  = [System.Collections.Generic.List[object]]::new()
    $nextPK    = $null
    $nextRK    = $null

    do {
        $qs = '$select=PartitionKey,RowKey'
        if ($Filter)  { $qs += "&`$filter=$([Uri]::EscapeDataString($Filter))" }
        if ($nextPK)  { $qs += "&NextPartitionKey=$([Uri]::EscapeDataString($nextPK))&NextRowKey=$([Uri]::EscapeDataString($nextRK))" }

        $uri = "$TableEndpoint/${TableName}()?$qs"

        $date       = [DateTime]::UtcNow.ToString('R')
        $uriObj     = [Uri]$uri
        $canonical  = "/$AccountName$($uriObj.AbsolutePath)"
        $auth = New-SharedKeyLiteHeader `
            -AccountName          $AccountName `
            -AccountKey           $AccountKey `
            -Method               'GET' `
            -Date                 $date `
            -CanonicalizedResource $canonical

        $headers = @{
            'Authorization'      = $auth
            'x-ms-date'          = $date
            'x-ms-version'       = '2020-12-06'
            'Accept'             = 'application/json;odata=nometadata'
            'DataServiceVersion' = '3.0;NetFx'
        }

        try {
            $resp = Invoke-WebRequest -Method GET -Uri $uri -Headers $headers -UseBasicParsing -ErrorAction Stop
        } catch {
            $sc = $_.Exception.Response.StatusCode.value__
            if ($sc -eq 404) { break }   # table does not exist yet
            throw
        }

        $body = $resp.Content | ConvertFrom-Json
        if ($body.value) {
            foreach ($e in $body.value) { $entities.Add($e) }
        }

        $nextPK = $resp.Headers['x-ms-continuation-NextPartitionKey']
        $nextRK = $resp.Headers['x-ms-continuation-NextRowKey']

    } while ($nextPK)

    # Cast to array so caller always gets a countable object, never $null
    return ,[object[]]$entities
}

# ── Hard-delete a single entity ───────────────────────────────────────────────
function Remove-TableEntity {
    param(
        [string]$TableName,
        [string]$PartitionKey,
        [string]$RowKey,
        [string]$AccountName,
        [string]$AccountKey,
        [string]$TableEndpoint
    )

    $pk  = [Uri]::EscapeDataString($PartitionKey)
    $rk  = [Uri]::EscapeDataString($RowKey)
    $uri = "$TableEndpoint/${TableName}(PartitionKey='${pk}',RowKey='${rk}')"

    Invoke-TableRequest `
        -Method        'DELETE' `
        -Uri           $uri `
        -AccountName   $AccountName `
        -AccountKey    $AccountKey `
        -TableEndpoint $TableEndpoint `
        -ExtraHeaders  @{ 'If-Match' = '*' } | Out-Null
}

# ── Delete a collection of entities, return count actually removed ─────────────
function Remove-EntityBatch {
    param(
        [System.Collections.Generic.List[object]]$Entities,
        [string]$TableName,
        [string]$AccountName,
        [string]$AccountKey,
        [string]$TableEndpoint,
        [string]$StepLabel,
        [switch]$DryRun
    )

    $count = $Entities.Count
    if ($count -eq 0) {
        Write-Info '  (no rows found)'
        return 0
    }

    if ($DryRun) {
        Write-Info "  Would delete $count row(s) from [$TableName] - $StepLabel"
        return $count
    }

    $deleted = 0
    foreach ($e in $Entities) {
        Remove-TableEntity `
            -TableName     $TableName `
            -PartitionKey  $e.PartitionKey `
            -RowKey        $e.RowKey `
            -AccountName   $AccountName `
            -AccountKey    $AccountKey `
            -TableEndpoint $TableEndpoint
        $deleted++
    }
    return $deleted
}

# ── Summary table builder ─────────────────────────────────────────────────────
$script:Summary = [System.Collections.Generic.List[hashtable]]::new()

function Add-SummaryRow {
    param([string]$Step, [string]$Table, [string]$Partition, [int]$Before, [int]$Deleted, [string]$Status)
    $script:Summary.Add(@{
        Step      = $Step
        Table     = $Table
        Partition = $Partition
        Before    = $Before
        Deleted   = $Deleted
        Status    = $Status
    })
}

function Print-Summary {
    param([bool]$DryRun)

    $header = if ($DryRun) { 'DRY-RUN SUMMARY (no changes made)' } else { 'OPERATION SUMMARY' }

    Write-Host ''
    Write-Host '======================================================================' -ForegroundColor Cyan
    Write-Host "  $header" -ForegroundColor Cyan
    Write-Host '======================================================================' -ForegroundColor Cyan
    Write-Host ''

    $fmt = '{0,-4} {1,-14} {2,-28} {3,8} {4,8}  {5}'
    Write-Host ($fmt -f 'Step', 'Table', 'Partition/Filter', 'Found', 'Deleted', 'Status') -ForegroundColor White
    Write-Host ('-' * 72) -ForegroundColor DarkGray

    $totalFound   = 0
    $totalDeleted = 0
    foreach ($row in $script:Summary) {
        $color = switch ($row.Status) {
            'OK'      { 'Green'  }
            'SKIPPED' { 'Yellow' }
            default   { 'Red'    }
        }
        Write-Host ($fmt -f $row.Step, $row.Table, $row.Partition, $row.Before, $row.Deleted, $row.Status) -ForegroundColor $color
        $totalFound   += $row.Before
        $totalDeleted += $row.Deleted
    }

    Write-Host ('-' * 72) -ForegroundColor DarkGray
    Write-Host ($fmt -f '', '', 'TOTAL', $totalFound, $totalDeleted, '') -ForegroundColor White
    Write-Host ''
}

# ══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════════════

Write-Host ''
Write-Host '======================================================================' -ForegroundColor Magenta
Write-Host '  Patient & Examination Data Reset Tool' -ForegroundColor Magenta
Write-Host '======================================================================' -ForegroundColor Magenta
Write-Host ''

# Parse connection string
try {
    $conn = Parse-ConnectionString -cs $ConnectionString
} catch {
    Write-Fail "Failed to parse ConnectionString: $_"
    exit 1
}

$accountName   = $conn.AccountName
$accountKey    = $conn.AccountKey
$tableEndpoint = $conn.TableEndpoint

Write-Info "Storage account : $accountName"
Write-Info "Table endpoint  : $tableEndpoint"
Write-Host ''

# ── Step 0: verify Azurite / storage is reachable ─────────────────────────────
Write-Step 'Verifying storage connectivity...'
try {
    $listUri   = "$tableEndpoint/Tables()"
    $date      = [DateTime]::UtcNow.ToString('R')
    $canonical = "/$accountName$([Uri]::new($listUri).AbsolutePath)"
    $auth = New-SharedKeyLiteHeader `
        -AccountName          $accountName `
        -AccountKey           $accountKey `
        -Method               'GET' `
        -Date                 $date `
        -CanonicalizedResource $canonical
    $headers = @{
        'Authorization'      = $auth
        'x-ms-date'          = $date
        'x-ms-version'       = '2020-12-06'
        'Accept'             = 'application/json;odata=nometadata'
        'DataServiceVersion' = '3.0;NetFx'
    }
    Invoke-RestMethod -Method GET -Uri $listUri -Headers $headers -ErrorAction Stop | Out-Null
    Write-Ok 'Storage is reachable'
} catch {
    Write-Fail "Cannot reach storage at $tableEndpoint"
    Write-Info 'Ensure Azurite is running:  .\start-azurite.ps1'
    Write-Info "Error: $_"
    exit 1
}

# ── Step 1: enumerate what will be deleted (always runs) ──────────────────────
Write-Host ''
Write-Step 'Enumerating entities to delete...'

$commonArgs = @{
    AccountName   = $accountName
    AccountKey    = $accountKey
    TableEndpoint = $tableEndpoint
}

$tilde = [char]0x7E

# Examinations table - MRN lookup rows  (PartitionKey eq 'MRN')
Write-Info 'Examinations / MRN partition...'
$examMrn = Get-AllEntities -TableName 'Examinations' -Filter "PartitionKey eq 'MRN'" @commonArgs

# Examinations table - EXAM lookup rows  (PartitionKey eq 'EXAM')
Write-Info 'Examinations / EXAM partition...'
$examLookup = Get-AllEntities -TableName 'Examinations' -Filter "PartitionKey eq 'EXAM'" @commonArgs

# Examinations table - per-patient timeline rows  (PartitionKey starts with 'PATIENT_')
Write-Info 'Examinations / PATIENT_* timeline rows...'
$examTimeline = Get-AllEntities -TableName 'Examinations' `
    -Filter "PartitionKey ge 'PATIENT_' and PartitionKey lt 'PATIENT$tilde'" @commonArgs

# Counters table - MRN year counters  (PartitionKey eq 'COUNTER', RowKey starts with 'MRN_')
Write-Info 'Counters / MRN_* counters...'
$mrnCounters = Get-AllEntities -TableName 'Counters' `
    -Filter "PartitionKey eq 'COUNTER' and RowKey ge 'MRN_' and RowKey lt 'MRN$tilde'" @commonArgs

# Patients table - search index rows  (PartitionKey starts with 'PATIENT_SEARCH_')
Write-Info 'Patients / PATIENT_SEARCH_* rows...'
$patientSearch = Get-AllEntities -TableName 'Patients' `
    -Filter "PartitionKey ge 'PATIENT_SEARCH_' and PartitionKey lt 'PATIENT_SEARCH$tilde'" @commonArgs

# Patients table - primary patient rows  (PartitionKey eq 'PATIENT')
Write-Info 'Patients / PATIENT rows...'
$patientPrimary = Get-AllEntities -TableName 'Patients' -Filter "PartitionKey eq 'PATIENT'" @commonArgs

# Patients table - legacy MRN lookup rows (PartitionKey eq 'MRN') [retired partition, written by old code]
Write-Info 'Patients / MRN legacy rows...'
$patientLegacyMrn = Get-AllEntities -TableName 'Patients' -Filter "PartitionKey eq 'MRN'" @commonArgs

# Totals
$grandTotal = $examMrn.Count + $examLookup.Count + $examTimeline.Count `
            + $mrnCounters.Count + $patientSearch.Count + $patientPrimary.Count `
            + $patientLegacyMrn.Count

Write-Host ''
Write-Host "  Found $grandTotal total entities to delete:" -ForegroundColor Yellow
Write-Info "  Examinations / MRN         : $($examMrn.Count)"
Write-Info "  Examinations / EXAM        : $($examLookup.Count)"
Write-Info "  Examinations / PATIENT_*   : $($examTimeline.Count)"
Write-Info "  Counters / MRN_*           : $($mrnCounters.Count)"
Write-Info "  Patients / PATIENT_SEARCH_*: $($patientSearch.Count)"
Write-Info "  Patients / PATIENT         : $($patientPrimary.Count)"
Write-Info "  Patients / MRN (legacy)    : $($patientLegacyMrn.Count)"
Write-Host ''

# ── WhatIf: just print summary and exit ───────────────────────────────────────
if ($WhatIfPreference) {
    Add-SummaryRow '1' 'Examinations' 'MRN'             $examMrn.Count            $examMrn.Count            'SKIPPED'
    Add-SummaryRow '2' 'Examinations' 'EXAM'            $examLookup.Count         $examLookup.Count         'SKIPPED'
    Add-SummaryRow '3' 'Examinations' 'PATIENT_*'       $examTimeline.Count       $examTimeline.Count       'SKIPPED'
    Add-SummaryRow '4' 'Counters'     'COUNTER/MRN_*'   $mrnCounters.Count        $mrnCounters.Count        'SKIPPED'
    Add-SummaryRow '5' 'Patients'     'PATIENT_SEARCH_*' $patientSearch.Count     $patientSearch.Count      'SKIPPED'
    Add-SummaryRow '6' 'Patients'     'PATIENT'         $patientPrimary.Count     $patientPrimary.Count     'SKIPPED'
    Add-SummaryRow '7' 'Patients'     'MRN (legacy)'    $patientLegacyMrn.Count   $patientLegacyMrn.Count   'SKIPPED'
    Print-Summary -DryRun $true
    Write-Host '  No changes were made (dry run).' -ForegroundColor Yellow
    exit 0
}

if ($grandTotal -eq 0) {
    Write-Ok 'Nothing to delete - all target partitions are already empty.'
    exit 0
}

# ── Confirmation prompt ────────────────────────────────────────────────────────
if (-not $Force) {
    Write-Host '  WARNING: This operation permanently deletes data.' -ForegroundColor Red
    Write-Host '     AuditLogs are preserved. Users are preserved.' -ForegroundColor Yellow
    Write-Host ''
    $confirm = Read-Host '  Type YES to proceed, anything else to abort'
    if ($confirm -ne 'YES') {
        Write-Warn 'Aborted by user.'
        exit 0
    }
    Write-Host ''
}

# ══════════════════════════════════════════════════════════════════════════════
#  Deletion pass - dependency order (child tables first)
# ══════════════════════════════════════════════════════════════════════════════

$overallStatus = 'SUCCESS'
$failedStep    = $null

$steps = @(
    @{ Label = '1'; Table = 'Examinations'; Partition = 'MRN';              Entities = $examMrn }
    @{ Label = '2'; Table = 'Examinations'; Partition = 'EXAM';             Entities = $examLookup }
    @{ Label = '3'; Table = 'Examinations'; Partition = 'PATIENT_*';        Entities = $examTimeline }
    @{ Label = '4'; Table = 'Counters';     Partition = 'COUNTER/MRN_*';    Entities = $mrnCounters }
    @{ Label = '5'; Table = 'Patients';     Partition = 'PATIENT_SEARCH_*'; Entities = $patientSearch }
    @{ Label = '6'; Table = 'Patients';     Partition = 'PATIENT';          Entities = $patientPrimary }
    @{ Label = '7'; Table = 'Patients';     Partition = 'MRN (legacy)';     Entities = $patientLegacyMrn }
)

foreach ($step in $steps) {
    $label     = $step.Label
    $tableName = $step.Table
    $partition = $step.Partition
    $entities  = $step.Entities
    $before    = $entities.Count

    Write-Step "Step $label - [$tableName] $partition  ($before rows)"

    if ($before -eq 0) {
        Write-Info '  (nothing to delete)'
        Add-SummaryRow $label $tableName $partition 0 0 'OK'
        continue
    }

    try {
        $deleted = 0
        foreach ($e in $entities) {
            Remove-TableEntity `
                -TableName     $tableName `
                -PartitionKey  $e.PartitionKey `
                -RowKey        $e.RowKey `
                -AccountName   $accountName `
                -AccountKey    $accountKey `
                -TableEndpoint $tableEndpoint
            $deleted++
        }
        Write-Ok "Deleted $deleted / $before rows"
        Add-SummaryRow $label $tableName $partition $before $deleted 'OK'
    } catch {
        $overallStatus = 'FAILED'
        $failedStep    = "Step $($label) [$($tableName) / $($partition)]"
        Write-Fail "Error during step $($label): $($_)"
        Add-SummaryRow $label $tableName $partition $before 0 'FAILED'
        break
    }
}

# ── Final report ──────────────────────────────────────────────────────────────
Print-Summary -DryRun $false

if ($overallStatus -eq 'SUCCESS') {
    Write-Host '  All patient and examination data has been deleted successfully.' -ForegroundColor Green
    Write-Host '     Run .\init-database.ps1 to re-seed the admin user.' -ForegroundColor Cyan
} else {
    Write-Host ''
    Write-Fail "Operation did not complete cleanly. Failed at: $failedStep"
    Write-Host ''
    Write-Host '  Manual recovery guidance:' -ForegroundColor Yellow
    Write-Host '  - Check which steps show status OK in the table above.' -ForegroundColor White
    Write-Host '  - The remaining steps were NOT executed - their data is intact.' -ForegroundColor White
    Write-Host '  - Re-run this script after fixing the underlying error.' -ForegroundColor White
    Write-Host '  - If partial deletion leaves orphaned records, re-run with -Force.' -ForegroundColor White
    Write-Host ''
    exit 1
}

# Made with Bob
