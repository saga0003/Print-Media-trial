param(
  [Parameter(Mandatory = $true)]
  [string]$TargetPath
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path $TargetPath).Path
$payload = Join-Path $PSScriptRoot 'payload'

if (-not (Test-Path (Join-Path $root 'package.json'))) {
  throw "package.json was not found directly inside: $root"
}
if (-not (Test-Path $payload)) {
  throw "The payload folder is missing from the V8 upgrade package."
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $root ".v8-backup-$stamp"
New-Item -ItemType Directory -Path $backup -Force | Out-Null

Get-ChildItem $payload -Recurse -File | ForEach-Object {
  $relative = $_.FullName.Substring($payload.Length).TrimStart('\','/')
  $destination = Join-Path $root $relative
  $destinationFolder = Split-Path $destination -Parent
  New-Item -ItemType Directory -Path $destinationFolder -Force | Out-Null

  if (Test-Path $destination) {
    $backupFile = Join-Path $backup $relative
    New-Item -ItemType Directory -Path (Split-Path $backupFile -Parent) -Force | Out-Null
    Copy-Item $destination $backupFile -Force
  }
  Copy-Item $_.FullName $destination -Force
}

$packagePath = Join-Path $root 'package.json'
$packageBackup = Join-Path $backup 'package.json'
Copy-Item $packagePath $packageBackup -Force
$package = Get-Content $packagePath -Raw | ConvertFrom-Json
if (-not $package.scripts) { $package | Add-Member -NotePropertyName scripts -NotePropertyValue ([pscustomobject]@{}) }
$package.scripts | Add-Member -Force -NotePropertyName 'test:v8-stage' -NotePropertyValue 'node scripts/test-v8-stage.mjs'
if (-not $package.dependencies) { $package | Add-Member -NotePropertyName dependencies -NotePropertyValue ([pscustomobject]@{}) }
if (-not $package.dependencies.recharts) {
  $package.dependencies | Add-Member -NotePropertyName recharts -NotePropertyValue '^3.1.2'
}
$package | ConvertTo-Json -Depth 100 | Set-Content $packagePath -Encoding UTF8

$envPath = Join-Path $root '.env.local'
$envBlock = @'

# SalesOS V8 Stage Analytics
STAGE_EVENTS_FILE=data/stage-events.runtime.json
STAGE_LEADS_FILE=data/stage-leads.runtime.json
STAGE_SYNC_FILE=data/stage-sync.runtime.json
STAGE_REPORTS_FILE=data/stage-reports.runtime.json
ODOO_STAGE_HISTORY_DAYS=730
ODOO_STAGE_TRACKING_LIMIT=50000
ODOO_STAGE_LEAD_LIMIT=10000
STAGE_REPORT_CACHE_SECONDS=120
SALESOS_TIME_ZONE=Asia/Kolkata
SALESOS_TIME_ZONE_OFFSET_MINUTES=330
'@
if (-not (Test-Path $envPath)) { New-Item -ItemType File -Path $envPath -Force | Out-Null }
$envText = Get-Content $envPath -Raw -ErrorAction SilentlyContinue
if ($envText -notmatch 'STAGE_EVENTS_FILE=') {
  Add-Content $envPath $envBlock
}
$envText = Get-Content $envPath -Raw -ErrorAction SilentlyContinue
$odooUrlMatch = [regex]::Match($envText, '(?m)^ODOO_URL=(.+)$')
if ($odooUrlMatch.Success -and $envText -notmatch '(?m)^NEXT_PUBLIC_ODOO_URL=') {
  Add-Content $envPath "`r`nNEXT_PUBLIC_ODOO_URL=$($odooUrlMatch.Groups[1].Value.Trim())"
}

$layoutPath = Join-Path $root 'src\app\layout.tsx'
if (Test-Path $layoutPath) {
  $layout = Get-Content $layoutPath -Raw
  if ($layout -notmatch 'salesos-v8-stage-launcher' -and $layout -match '</body>') {
    $layoutBackup = Join-Path $backup 'src\app\layout.tsx'
    New-Item -ItemType Directory -Path (Split-Path $layoutBackup -Parent) -Force | Out-Null
    Copy-Item $layoutPath $layoutBackup -Force
    $launcher = @'
        <a
          id="salesos-v8-stage-launcher"
          href="/stage-analytics"
          style={{ position: "fixed", right: 18, bottom: 18, zIndex: 9999, padding: "10px 14px", borderRadius: 12, background: "#131E35", color: "white", fontWeight: 700, textDecoration: "none", boxShadow: "0 8px 24px rgba(0,0,0,.22)" }}
        >
          V8 Stage Analytics
        </a>
'@
    $layout = $layout.Replace('</body>', "$launcher`r`n      </body>")
    Set-Content $layoutPath $layout -Encoding UTF8
  }
}

Write-Host ''
Write-Host 'SalesOS V8 Stage Analytics installed.' -ForegroundColor Green
Write-Host "Backup created at: $backup"
Write-Host ''
Write-Host 'Next commands:' -ForegroundColor Cyan
Write-Host "  Set-Location `"$root`""
Write-Host '  npm install --registry=https://registry.npmjs.org/'
Write-Host '  npm run test:v8-stage'
Write-Host '  npm run typecheck'
Write-Host '  npm run dev'
Write-Host ''
Write-Host 'Open: http://localhost:3000/stage-analytics'
