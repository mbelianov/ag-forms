<#
.SYNOPSIS
  Verify that a storage account is suitable for the PAP signed-PDF archive and (optionally) apply the
  lifecycle policy. Read-only unless -Apply is given. Origin: technical spike O-4, check (5).

.DESCRIPTION
  Verifies against the REAL account (the Azurite emulator cannot do this):
    - kind = StorageV2 and hierarchical namespace disabled (blob index tags + lifecycle need this)
    - blob soft delete and container soft delete DISABLED
    - blob versioning DISABLED
    - public blob access disabled, minimum TLS 1.2
    - the lifecycle policy (retention rule + orphan "pending" rule) is accepted by the service

  -Apply REPLACES the account's whole lifecycle management policy (Azure has one policy per account).
  If the account already has rules other than the two PAP rules, -Apply refuses unless -Force is given.
  Container name and blob prefix in the template (pap-pdfs / pap/) must match the application.

  Use the SAME value for -RetentionDays and for the app setting PAP_PDF_RETENTION_DAYS.
  A policy change can take up to 24 h to take effect.

.EXAMPLE
  ./verify-storage-account.ps1 -ResourceGroup rg-agforms -AccountName stagforms -RetentionDays 90
  ./verify-storage-account.ps1 -ResourceGroup rg-agforms -AccountName stagforms -RetentionDays 90 -Apply
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)] [string] $ResourceGroup,
  [Parameter(Mandatory)] [string] $AccountName,
  [ValidateRange(1, 3650)] [int] $RetentionDays = 90,
  [switch] $Apply,
  [switch] $Force
)
$ErrorActionPreference = 'Stop'
$PapRuleNames = @('pap-pdf-retention', 'pap-pdf-orphan-pending')

$acct = az storage account show -g $ResourceGroup -n $AccountName -o json | ConvertFrom-Json
$blob = az storage account blob-service-properties show -g $ResourceGroup --account-name $AccountName -o json | ConvertFrom-Json

$checks = @(
  [pscustomobject]@{ Check = 'Account kind is StorageV2';        Pass = ($acct.kind -eq 'StorageV2');                          Actual = $acct.kind }
  [pscustomobject]@{ Check = 'Hierarchical namespace disabled';  Pass = (-not $acct.isHnsEnabled);                             Actual = $acct.isHnsEnabled }
  [pscustomobject]@{ Check = 'Blob soft delete disabled';        Pass = (-not $blob.deleteRetentionPolicy.enabled);            Actual = "enabled=$($blob.deleteRetentionPolicy.enabled) days=$($blob.deleteRetentionPolicy.days)" }
  [pscustomobject]@{ Check = 'Container soft delete disabled';   Pass = (-not $blob.containerDeleteRetentionPolicy.enabled);  Actual = "enabled=$($blob.containerDeleteRetentionPolicy.enabled) days=$($blob.containerDeleteRetentionPolicy.days)" }
  [pscustomobject]@{ Check = 'Blob versioning disabled';         Pass = (-not $blob.isVersioningEnabled);                      Actual = $blob.isVersioningEnabled }
  [pscustomobject]@{ Check = 'Public blob access disabled';      Pass = (-not $acct.allowBlobPublicAccess);                    Actual = $acct.allowBlobPublicAccess }
  [pscustomobject]@{ Check = 'TLS 1.2 or higher';                Pass = ($acct.minimumTlsVersion -in 'TLS1_2', 'TLS1_3');      Actual = $acct.minimumTlsVersion }
)
$checks | Format-Table -AutoSize
$failed = @($checks | Where-Object { -not $_.Pass }).Count

# Policy: substitute the single retention parameter, then validate it is well-formed JSON.
$tpl = Get-Content (Join-Path $PSScriptRoot 'lifecycle-policy.template.json') -Raw
$json = $tpl.Replace('__RETENTION_DAYS__', "$RetentionDays")
$null = $json | ConvertFrom-Json

if ($Apply) {
  if ($failed -gt 0) {
    Write-Host "Refusing to apply: $failed prerequisite(s) failed (see table)." -ForegroundColor Red
    exit 1
  }
  # One policy per account: do not silently wipe rules that belong to something else.
  $existingJson = az storage account management-policy show -g $ResourceGroup --account-name $AccountName -o json 2>$null
  if ($LASTEXITCODE -eq 0 -and $existingJson) {
    $others = @(($existingJson | ConvertFrom-Json).policy.rules | Where-Object { $PapRuleNames -notcontains $_.name })
    if ($others.Count -gt 0 -and -not $Force) {
      Write-Host "Account already has $($others.Count) other lifecycle rule(s): $($others.name -join ', '). Merge them into the template or pass -Force to replace them." -ForegroundColor Red
      exit 1
    }
  }
  $tmp = Join-Path ([IO.Path]::GetTempPath()) "pap-lifecycle-$([guid]::NewGuid()).json"
  [IO.File]::WriteAllText($tmp, $json, (New-Object Text.UTF8Encoding $false))
  try {
    az storage account management-policy create -g $ResourceGroup --account-name $AccountName --policy "@$tmp" -o none
    if ($LASTEXITCODE -ne 0) { throw 'az management-policy create failed' }
    Write-Host "Lifecycle policy applied (retention = $RetentionDays days). It can take up to 24 h to take effect." -ForegroundColor Green
    Write-Host "Set PAP_PDF_RETENTION_DAYS=$RetentionDays in the SWA application settings." -ForegroundColor Green
  } finally { Remove-Item $tmp -ErrorAction SilentlyContinue }
} else {
  Write-Host 'Policy JSON is well-formed (not applied; re-run with -Apply).' -ForegroundColor Yellow
}

if ($failed -gt 0) {
  Write-Host 'One or more prerequisites FAILED - see table.' -ForegroundColor Red
  exit 1
}
Write-Host 'All storage prerequisites passed.' -ForegroundColor Green
