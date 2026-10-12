#requires -Version 5.1
[CmdletBinding()]
param([switch]$SkipBrowser)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Invoke-Wslc([string[]] $Arguments) {
    & wslc @Arguments
    if ($LASTEXITCODE -ne 0) { throw "wslc $($Arguments -join ' ') failed with code $LASTEXITCODE" }
}
function Ensure-Resource([string] $Kind, [string] $Name) {
    $list = & wslc $Kind list 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { throw "Could not list wslc $Kind objects: $list" }
    if ($list -notmatch [regex]::Escape($Name)) {
        Write-Host "Creating $Kind $Name"
        Invoke-Wslc -Arguments @($Kind, 'create', $Name)
    }
}
function Ensure-NotRunning([string] $Name) {
    $output = & wslc container list --all 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { throw 'Could not query wslc containers.' }
    if ($output -match [regex]::Escape($Name)) {
        throw "Existing container '$Name' found. Run .\stop-wslc.ps1 first."
    }
}
if (-not (Get-Command wslc -ErrorAction SilentlyContinue)) { throw 'Run wsl --update to install wslc >= 2.9.3.' }
Ensure-Resource network 'cro-weather-net'
Ensure-Resource volume 'cro-weather-redis-data'
foreach ($name in @('cro-weather-redis', 'cro-weather-api', 'cro-weather-web')) { Ensure-NotRunning $name }
Write-Host '[1/3] Starting Redis' -ForegroundColor Cyan
Invoke-Wslc -Arguments @('run', '-d', '--rm', '--name', 'cro-weather-redis', '--network', 'cro-weather-net', '-v', 'cro-weather-redis-data:/data', 'redis:7.4-alpine', 'redis-server', '--appendonly', 'yes', '--maxmemory', '128mb', '--maxmemory-policy', 'allkeys-lru')
Write-Host '[2/3] Starting FastAPI (localhost:8000)' -ForegroundColor Cyan
Invoke-Wslc -Arguments @('run', '-d', '--rm', '--name', 'cro-weather-api', '--network', 'cro-weather-net', '-p', '127.0.0.1:8000:8000', '-e', 'REDIS_URL=redis://cro-weather-redis:6379/0', 'cro-weather-backend:1.0.0')
Write-Host '[3/3] Starting Next.js (localhost:3000)' -ForegroundColor Cyan
Invoke-Wslc -Arguments @('run', '-d', '--rm', '--name', 'cro-weather-web', '--network', 'cro-weather-net', '-p', '127.0.0.1:3000:3000', '-e', 'API_INTERNAL_URL=http://cro-weather-api:8000', 'cro-weather-frontend:1.0.0')
Write-Host 'CroWeather Pro startup requested.' -ForegroundColor Green
Write-Host 'Website: http://localhost:3000'
Write-Host 'API docs: http://localhost:8000/docs'
Write-Host 'Status:   wslc container list'
Write-Host 'Logs:     wslc container logs cro-weather-api'
if (-not $SkipBrowser) { Start-Process 'http://localhost:3000' }
