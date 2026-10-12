# CroWeather Pro

A weather dashboard for Croatia, using DHMZ observations and WSL Containers (`wslc`) on Windows.

Built with Next.js App Router, FastAPI and Redis. Features include place search, browser geolocation, a county map, nearest-station selection and a history of observations collected by the application.

> Weather values are **actual station observations**, never invented weather for the selected town. Data may be absent, delayed or stale. This is not a forecast or safety-critical alert service.

## Quick start (Windows 11)

**Requirements:** Windows 11; WSL 2.9.3 or later, `wslc.exe`; PowerShell 5.1 or 7+; an Internet connection for image builds, GeoNames, geoBoundaries, and the DHMZ feed. Docker Desktop is not required.

```powershell
wsl --update
wsl --version
wslc version
wslc run --rm hello-world

# Clone this repository (or extract its ZIP), then open PowerShell in its folder
.\build-wslc.ps1
.\run-wslc.ps1
```

- App: http://localhost:3000
- Backend Swagger: http://localhost:8000/docs
- Health: http://localhost:8000/api/health
- Prometheus: http://localhost:8000/api/metrics

```powershell
# Inspect the running services
wslc container list
wslc container logs cro-weather-api
wslc container logs cro-weather-web

# Stop cleanly; preserve the Redis volume
.\stop-wslc.ps1
```

**Important:** The first image builds download the **complete Croatia-only GeoNames dump** and the **actual Croatian county boundaries** from geoBoundaries. The source-controlled seed and official-station registry contain real coordinates for offline development, but the strict `wslc` backend build deliberately fails if a full GeoNames dataset cannot be downloaded. This prevents presenting an incomplete settlement index as complete. Internet access is required at image-build time, not for subsequent geographic lookups.

## What the application does

1. Fetches `https://vrijeme.hr/hrvatska1_n.xml`, parses the `Grad`/`Podatci` structure, and stores current data in Redis for 60 seconds. A cached last-good snapshot can survive feed outages for up to 24h, clearly labelled **stale**.
2. Stores deduplicated real weather observations by station in Redis (maximum 96 points / 14 days per station); historical charts do not fabricate 60-second measurements. The DHMZ feed is updated approximately hourly, even if the app checks every minute.
3. Indexes Croatia's settlements, cities and municipalities via GeoNames, with diacritic-insensitive fuzzy search, and resolves each requested location to the nearest geocoded **reporting** station using Haversine distance.
4. Displays interactive county polygons sourced from geoBoundaries gbOpen ADM1, alongside station markers, hover/focus/click, zoom and selection.
5. Includes keyboard controls, theme switching, responsive layouts and browser geolocation (automatic only when previously permitted).

## API endpoints

| Endpoint | Description |
|---|---|
| `GET /api/weather` | All current DHMZ station observations and source freshness |
| `GET /api/stations` | Stations and geographic metadata when resolved |
| `GET /api/station/{name}` | One station (URL-encoded name) |
| `GET /api/location?lat=45.8&lon=15.71` | Nearest geocoded station and distance in km |
| `GET /api/search?q=zag` | Fuzzy city/municipality/settlement + station search |
| `GET /api/history?station=Zagreb-Maksimir` | Stored real observations (since service started) |
| `GET /api/health` | Health, Redis and feed freshness; 503 on degradation |
| `GET /api/metrics` | Prometheus HTTP counters and response latencies |
| `GET /docs` | OpenAPI / Swagger UI |

## Local development (without a container)

```bash
cd backend
python3.12 -m venv .venv
# Activate your environment
pip install -r requirements-dev.txt
python scripts/bootstrap_geo.py --strict
redis-server # separately; or point REDIS_URL to an existing Redis
uvicorn app.main:app --reload
```

```bash
cd frontend
npm install
npm run geo:sync
npm run dev
```

For local Next.js, API requests route through `http://127.0.0.1:8000` unless `API_INTERNAL_URL` is set. To check the backend tests: `cd backend && python -m pytest -q`.

## Quality and limitations

- Fail closed on missing source data: no fake samples, fake forecasts, or silent geographic assumptions.
- Station coordinates are resolved first from the government’s 2026 official station-location register, then explicitly known station aliases and GeoNames. Stations with unresolved coordinates remain visible in API data but cannot be used for nearest-neighbour calculations. Check your deployment's coverage after first fetch.
- The dashboard is intended for local development and demonstrations. Redis persistence and internal service networking work on a single Windows workstation. **Do not expose this stack directly to the public Internet** without a TLS reverse proxy, auth where needed, rate limits, monitoring, tested backup/restore, and resilient deployment orchestration.
- `wslc` currently has no built-in Compose parity or production cluster failover; service lifecycle is explicitly scripted.
- Lighthouse 90+ is a target and has not been verified in this environment. Run Lighthouse on a fully launched production build.

## Licences and attribution

Weather observations © DHMZ – Državni hidrometeorološki zavod, [meteo.hr](https://meteo.hr), available under the Open Licence of the Republic of Croatia. Mandatory attribution is displayed in the UI.

Croatian location names/coordinates from [GeoNames](https://www.geonames.org/) — CC BY 4.0. Official weather-station positions from [Narodne novine 5/2026](https://narodne-novine.nn.hr/clanci/sluzbeni/2026_01_5_30.html). County boundaries from [geoBoundaries gbOpen](https://www.geoboundaries.org/) — CC BY 4.0. Library dependencies carry their own licences. This project's original code is MIT licensed.

Read [architecture](docs/ARCHITECTURE.md), [deployment](docs/DEPLOYMENT.md), [data sources](docs/DATA_SOURCES.md), and [testing](docs/TESTING.md) for specifics.

## Verification status

The repository includes GitHub Actions checks for backend tests, frontend typechecking, linting, county-data synchronization and a production build. Container runtime verification requires a supported Windows host and is separate from those checks.

During the local repository review on October 12, 2026, `wslc version` returned `3.0.1.0`, but `build-wslc.ps1` failed on the backend image with `ERROR_FILE_NOT_FOUND`. The three-container production runtime and browser acceptance walkthrough have therefore **not been verified**. Backend tests could not run because `pytest` was unavailable; frontend checks could not run because the local npm launcher was broken and dependencies were absent. See [testing](docs/TESTING.md) for the checks to run in a configured environment.


## Learn WSL Containers directly (no wrapper scripts)

Read [`WSLC_COMMANDS.md`](WSLC_COMMANDS.md) for the full `wslc` command workflow, including a diagnostic for `ERROR_FILE_NOT_FOUND` during builds on Windows. From the repository root, build with `wslc build -t cro-weather-backend:1.0.0 .\backend` and `wslc build -t cro-weather-frontend:1.0.0 .\frontend`.
