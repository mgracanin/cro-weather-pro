#requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Push-Location $PSScriptRoot
try {
    if (-not (Get-Command wslc -ErrorAction SilentlyContinue)) {
        throw 'wslc.exe is missing. Run wsl --update, then verify with wsl --version and wslc version.'
    }

    foreach ($relativeDockerfile in @('backend/Dockerfile', 'frontend/Dockerfile')) {
        if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot $relativeDockerfile) -PathType Leaf)) {
            throw "Missing required Dockerfile: $relativeDockerfile (project root: $PSScriptRoot)"
        }
    }

    Write-Host '[1/3] WSL Containers runtime' -ForegroundColor Cyan
    & wslc version
    if ($LASTEXITCODE -ne 0) { throw 'wslc is installed but cannot start. Try: wslc run --rm hello-world' }

    # No -f flag is needed: each build context contains its own Dockerfile.
    # An unqualified `-f Dockerfile` here would incorrectly reference the
    # repository root, which has no Dockerfile (only backend/ and frontend/ do).
    Write-Host '[2/3] Building FastAPI + Croatian GeoNames gazetteer' -ForegroundColor Cyan
    & wslc build -t cro-weather-backend:1.0.0 (Join-Path $PSScriptRoot 'backend')
    if ($LASTEXITCODE -ne 0) {
        throw "Backend image build failed (exit $LASTEXITCODE). Examine the wslc output above; a build-path/runtime issue is not necessarily a GeoNames download failure."
    }

    Write-Host '[3/3] Building Next.js + real county GeoJSON' -ForegroundColor Cyan
    & wslc build -t cro-weather-frontend:1.0.0 (Join-Path $PSScriptRoot 'frontend')
    if ($LASTEXITCODE -ne 0) {
        throw "Frontend image build failed (exit $LASTEXITCODE). Examine the wslc output above; a build-path/runtime issue is not necessarily a geoboundaries.org download failure."
    }

    Write-Host 'Images built: cro-weather-backend:1.0.0, cro-weather-frontend:1.0.0' -ForegroundColor Green
}
finally {
    Pop-Location
}
