#requires -Version 5.1
[CmdletBinding()]
param()
if (-not (Get-Command wslc -ErrorAction SilentlyContinue)) { throw 'wslc.exe was not found.' }
foreach ($name in @('cro-weather-web', 'cro-weather-api', 'cro-weather-redis')) {
    Write-Host "Stopping $name"
    & wslc container stop $name 2>$null
    if ($LASTEXITCODE -ne 0) { Write-Host "Already stopped or not present: $name" }
}
Write-Host 'Stopped. Persistent Redis volume and images have been preserved.' -ForegroundColor Green
