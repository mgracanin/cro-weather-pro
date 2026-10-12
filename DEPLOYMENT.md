# Deployment: Windows 11 + `wslc`

## Installation

Open an elevated PowerShell for WSL installation/update, then an ordinary PowerShell 7 window for the app:

```powershell
wsl --install
wsl --update
wsl --version
wslc version
wslc run --rm hello-world
```

WSL Containers is a built-in WSL feature in WSL >= 2.9.3, generally available from September 29, 2026. Build requires Internet reachability of NPM, PyPI, Docker Hub registries, GeoNames and geoBoundaries. The weather API requires DHMZ reachability when first populated.

## Build

```powershell
.\build-wslc.ps1
```

Equivalent manual commands, from the repository root:

```powershell
wslc build -t cro-weather-backend:1.0.0 .\backend
wslc build -t cro-weather-frontend:1.0.0 .\frontend
wslc image list
```

## Container lifecycle

```powershell
.\run-wslc.ps1
# or create network and volume manually
wslc network create cro-weather-net
wslc volume create cro-weather-redis-data
wslc run -d --rm --name cro-weather-redis --network cro-weather-net -v cro-weather-redis-data:/data redis:7.4-alpine redis-server --appendonly yes --maxmemory 128mb --maxmemory-policy allkeys-lru
wslc run -d --rm --name cro-weather-api --network cro-weather-net -p 127.0.0.1:8000:8000 -e REDIS_URL=redis://cro-weather-redis:6379/0 cro-weather-backend:1.0.0
wslc run -d --rm --name cro-weather-web --network cro-weather-net -p 127.0.0.1:3000:3000 -e API_INTERNAL_URL=http://cro-weather-api:8000 cro-weather-frontend:1.0.0
```

Container DNS resolves `cro-weather-api` and `cro-weather-redis` by name on the shared `cro-weather-net` bridge network. Browsers connect to `http://localhost:3000` and use `/api/...`; the Next.js route handler proxies calls internally. Port 8000 is published only for the API/Swagger demonstration. Redis is never exposed on a host port.

```powershell
wslc container list
wslc container logs cro-weather-api
wslc exec cro-weather-redis redis-cli ping
Invoke-RestMethod http://localhost:8000/api/weather
Invoke-RestMethod http://localhost:8000/api/health
.\stop-wslc.ps1
```

## Troubleshooting

- `wslc not found` — `wsl --update` then verify WSL >= 2.9.3.
- Port bound — stop other apps using 3000/8000, including Docker Desktop containers if installed.
- Download errors during build — confirm unrestricted HTTPS egress for PyPI/NPM, GeoNames, geoBoundaries, registries. The first build intentionally fails rather than ship an incomplete nationwide index/map.
- `503` during cold start — Redis or DHMZ has not yet responded; check `wslc container logs cro-weather-api` and `/api/health`.
- No map — ensure the frontend build ran `npm run geo:sync` and retrieved geoBoundaries county polygons.
- No chart trend — history begins when the deployed instance first receives real observations; the feed itself does not publish minute-by-minute station observations.
- No station near requested locality — inspect station coordinate metadata; unresolved station names remain in station list but cannot be used in the nearest-neighbour index.
- `wslc` does not have Compose or Docker Desktop's graphical dashboards; scripts provide deterministic container lifecycle for this workstation demonstration.

## Production considerations

The stack is a single-host showcase. For public deployment add an ingress with TLS, rate limiting and WAF, redundant Redis/backup, error reporting, alerts, and an orchestrator with health-based restart behavior. Protect Prometheus metrics and internal API endpoints at the edge. Test disaster recovery, container state and image supply-chain vulnerabilities before exposing this to external users.
