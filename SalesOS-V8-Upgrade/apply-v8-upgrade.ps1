param(
    [Parameter(Mandatory = $true)]
    [string]$TargetPath
)

$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

$TargetPath = (Resolve-Path $TargetPath).Path
$PackageJsonPath = Join-Path $TargetPath "package.json"
$SourcePath = Join-Path $TargetPath "src"

if (-not (Test-Path $PackageJsonPath)) {
    throw "package.json was not found in: $TargetPath. Select the folder that directly contains package.json."
}
if (-not (Test-Path $SourcePath)) {
    throw "src folder was not found in: $TargetPath"
}

$UpgradeRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PayloadPath = Join-Path $UpgradeRoot "payload"
if (-not (Test-Path $PayloadPath)) {
    throw "V8 payload folder is missing: $PayloadPath"
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupPath = Join-Path $TargetPath ".v8-backup-$Timestamp"
New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null

Write-Step "Backing up files that V8 will replace"
$PayloadFiles = Get-ChildItem -Path $PayloadPath -Recurse -File
foreach ($File in $PayloadFiles) {
    $RelativePath = $File.FullName.Substring($PayloadPath.Length).TrimStart('\', '/')
    $Destination = Join-Path $TargetPath $RelativePath
    if (Test-Path $Destination) {
        $BackupDestination = Join-Path $BackupPath $RelativePath
        New-Item -ItemType Directory -Path (Split-Path $BackupDestination -Parent) -Force | Out-Null
        Copy-Item -Path $Destination -Destination $BackupDestination -Force
    }
}

Write-Step "Copying the V8 stage analytics layer"
foreach ($File in $PayloadFiles) {
    $RelativePath = $File.FullName.Substring($PayloadPath.Length).TrimStart('\', '/')
    $Destination = Join-Path $TargetPath $RelativePath
    New-Item -ItemType Directory -Path (Split-Path $Destination -Parent) -Force | Out-Null
    Copy-Item -Path $File.FullName -Destination $Destination -Force
}

Write-Step "Cleaning generated V8 source for strict TypeScript projects"
$StagePage = Join-Path $TargetPath "src\components\v8\StageAnalyticsPage.tsx"
if (Test-Path $StagePage) {
    $Content = Get-Content $StagePage -Raw
    $Content = $Content.Replace(
        'import { useCallback, useEffect, useMemo, useState } from "react";',
        'import { useCallback, useEffect, useState } from "react";'
    )
    $Content = $Content.Replace("  Users,`r`n", "")
    $Content = $Content.Replace("  Users,`n", "")
    $UnusedBlock = '(?ms)^  const stageLeadCounts = useMemo\(\(\) => \{.*?^  \}, \[data\]\);\r?\n'
    $Content = [regex]::Replace($Content, $UnusedBlock, "")
    Set-Content -Path $StagePage -Value $Content -Encoding UTF8
}

Write-Step "Adding the V8 validation command to package.json"
$Package = Get-Content $PackageJsonPath -Raw | ConvertFrom-Json
if (-not $Package.scripts) {
    $Package | Add-Member -MemberType NoteProperty -Name scripts -Value ([pscustomobject]@{})
}
$Package.scripts | Add-Member -MemberType NoteProperty -Name "test:v8-stage" -Value "node scripts/test-v8-stage.mjs" -Force
$Package | ConvertTo-Json -Depth 100 | Set-Content -Path $PackageJsonPath -Encoding UTF8

$EnvironmentLines = @(
    "",
    "# SalesOS V8 stage-event analytics",
    "STAGE_EVENTS_FILE=data/stage-events.runtime.json",
    "STAGE_REPORTS_FILE=data/stage-reports.runtime.json",
    "ODOO_STAGE_HISTORY_DAYS=730",
    "ODOO_STAGE_MESSAGE_LIMIT=50000",
    "SALESOS_TIME_ZONE=Asia/Kolkata",
    "SALESOS_TIME_ZONE_OFFSET_MINUTES=330"
)

foreach ($EnvironmentFileName in @(".env.example", ".env.local")) {
    $EnvironmentFile = Join-Path $TargetPath $EnvironmentFileName
    if (Test-Path $EnvironmentFile) {
        $Existing = Get-Content $EnvironmentFile -Raw
        if ($Existing -notmatch '(?m)^STAGE_EVENTS_FILE=') {
            Add-Content -Path $EnvironmentFile -Value ($EnvironmentLines -join "`r`n") -Encoding UTF8
        }
    }
}

Write-Step "Creating persistent V8 data files"
$DataPath = Join-Path $TargetPath "data"
New-Item -ItemType Directory -Path $DataPath -Force | Out-Null
$StageEvents = Join-Path $DataPath "stage-events.runtime.json"
$StageReports = Join-Path $DataPath "stage-reports.runtime.json"
if (-not (Test-Path $StageEvents)) {
    $Now = (Get-Date).ToUniversalTime().ToString("o")
    $Initial = [ordered]@{
        version = 1
        generatedAt = $Now
        lastSyncedAt = ""
        stages = @()
        events = @()
        snapshots = @()
        sync = [ordered]@{
            fullFrom = ""
            fullTo = ""
            latestMessageId = 0
            latestMessageDate = ""
        }
    }
    $Initial | ConvertTo-Json -Depth 20 | Set-Content -Path $StageEvents -Encoding UTF8
}
if (-not (Test-Path $StageReports)) {
    "[]" | Set-Content -Path $StageReports -Encoding UTF8
}

Write-Step "Writing launch note"
$LaunchNote = @"
# SalesOS V8 launch

The V8 stage analytics route is:

http://localhost:3000/stage-analytics

Run:

npm install --registry=https://registry.npmjs.org/
npm run test:v8-stage
npm run typecheck
npm run dev

First use: open Stage Analytics and click **Run first full sync**.
Normal Apply Filters requests read the local analytics cache and do not re-fetch all Odoo chatter.

Backup created at:
$BackupPath
"@
Set-Content -Path (Join-Path $TargetPath "V8-LAUNCH.md") -Value $LaunchNote -Encoding UTF8

Write-Host "`nSalesOS V8 upgrade files were installed successfully." -ForegroundColor Green
Write-Host "Backup: $BackupPath" -ForegroundColor DarkGray
Write-Host "Next:" -ForegroundColor Yellow
Write-Host "  Set-Location `"$TargetPath`""
Write-Host "  npm install --registry=https://registry.npmjs.org/"
Write-Host "  npm run test:v8-stage"
Write-Host "  npm run typecheck"
Write-Host "  npm run dev"
Write-Host "Open: http://localhost:3000/stage-analytics"
