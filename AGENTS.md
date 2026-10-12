# CroWeather Pro — coding agent instructions

**Read `PROJECT_PROMPT.md` and `README.md` before making changes.** This repository demonstrates Microsoft's native Windows WSL Containers, not Docker Desktop. Preserve that primary deployment path in all changes.

## Engineering guardrails

1. Never fabricate weather values, forecasts, county shapes, station coordinates, observations, or benchmark results. Show explicit null/503/stale states. Use live DHMZ for weather.
2. The geography index must contain only Croatian places. Resolve weather from the nearest available geocoded station using Haversine; the measurement belongs to that station.
3. Prefer 2026 official gazette station coordinates, then curated station aliases, then GeoNames locations. Keep the full government registry importer rather than hardcoding 12 stations.
4. All fetches of DHMZ go through FastAPI/Redis caching with a 60-second minimum interval and failure backoff. Client-side geolocation is only requested with permission.
5. Use Next.js 15 App Router, strongly typed TypeScript, FastAPI/Pydantic, Tailwind v4, shadcn-pattern UI components, Recharts and Framer Motion.
6. Add tests for every changed parser, geographic matching routine, or cache behavior; document externally sourced data and licences.
7. Do not introduce Docker Compose, Docker Desktop, fictional benchmark results, or a requirement for paid weather APIs.

## Review workflow

1. Inspect the relevant code and docs.
2. Make minimal coherent edits, update associated tests.
3. Run backend unit tests, frontend `typecheck`, lint and production build with dependencies installed. Use `wslc` runtime tests on Windows, and report clearly when unavailable.
4. Verify mobile layout, theme contrast, station/region selection, search without diacritics, and network failure states.
5. Maintain `docs/DEPLOYMENT.md` for any change in CLI usage.

## Important commands

```powershell
.\build-wslc.ps1
.\run-wslc.ps1
wslc container list
wslc container logs cro-weather-api
.\stop-wslc.ps1
```

Never claim a production runtime has been tested without executing the image build and running the three containers on a supported Windows host.
