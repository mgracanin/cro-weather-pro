# Architecture

## Overview

```text
Windows 11 / Microsoft WSL Containers (wslc)

   Browser :3000
       │  Next.js frontend
       ▼
  Next.js 15 App Router (cro-weather-web)
       │ SSR + same-origin /api proxy
       ▼
  FastAPI Python 3.12 (cro-weather-api) :8000
       ├── DHMZ XML client (external HTTPS, every >= 60s)
       ├── GeoNames Croatia index (bundled at container build)
       └── Redis (cro-weather-redis) :6379, internal only
             ├── 60s weather snapshot
             ├── 24h last-known-good stale fallback
             ├── short distributed fetch mutex
             └── rolling 96-point/station observation history
```

All three containers share a user-created WSL container bridge network `cro-weather-net`. Only web port 3000 and API port 8000 are forwarded to Windows loopback. Redis is not published. No Docker Engine, daemon, Compose, or Docker Desktop. Images use OCI-style Dockerfiles built with `wslc build`.

## Data handling

- Observations from DHMZ are tagged with the **source timestamp**, while a separate `fetched_at` records when the application last retrieved the feed.
- Duplicate station/time measurements are not appended to chart series; an hourly feed generates hourly history, not minute-level fictional readings.
- Only nonempty parsed XML station records are accepted, and no client may control the feed URL.
- A warm cache protects against transient source errors. Last-good snapshots are labelled stale; during cold-source failures the endpoint returns HTTP 503.
- `haversine_distance` calculates great-circle distance, not altitude-adjusted, road, or local weather equivalence.
- A station lacking source-backed coordinates is excluded from proximity matching rather than given a guessed location.
- `GET /api/health` is degraded (HTTP 503) if Redis is unreachable or no recent successful feed retrieval exists.

## Data models

`WeatherObservation`: name, lat/lon or null, region, observed_at, temperature_c, humidity_pct, pressure_hpa, wind_speed_ms, wind_direction, conditions. All weather properties nullable.

`WeatherSnapshot`: fetched_at, source, stale, stations.

`LocatedWeather`: requested (optional), nearest_station, distance_km, attribution.

`SearchHit`: name, lat, lon, region, category, optional distance_km.

`HistoryPoint`: timestamp, temperature_c, humidity_pct, pressure_hpa, wind_speed_ms.

## Geographic pipeline

During backend image build, `scripts/bootstrap_geo.py --strict` downloads `HR.zip` and GeoNames administrative names. It retains Croatia-only populated places and administrative level 1–3 nodes, preserving duplicate town names at distinct coordinates. It adds a modest curated list for early dev.

The station metadata importer also extracts official DMS latitude/longitude pairs from Croatian Government Decision NN 5/2026 and stores coordinate overrides in `official_stations.json`. Exact station aliases have priority over place-center approximation.

At frontend image build, `scripts/fetch-counties.mjs` retrieves GeoJSON polygons from the open geoBoundaries HRV ADM1 API. The map uses an SVG with d3-geo projection, allowing pointer and keyboard selection of counties, along with station markers. Region click resolves the county geographic centroid to its nearest active weather station. The index stores no non-Croatian places.

## Security and runtime posture

- XML is parsed with `defusedxml`; payload capped at 2MB; HTTP timeouts; no user-defined HTTP destinations.
- API proxy route whitelist, same-origin browser access, browser permission before GPS, no collected user geolocation server-side persistence.
- HTTP security headers, loopback bind ports, Redis network isolation, non-root image users.
- Single-process API is intentional: background polling + Redis distributed fetch guard provide consistent caching on one Windows host.
- Observability via Prometheus default process metrics and labelled request histograms.

## Performance

- Next.js App Router server renders the initial payload; subsequent client polls do not reload the page.
- Map and charts are separated into UI components; chart module is dynamically loaded.
- Station count varies with DHMZ reporting; not all stations have complete sensor readings.
- Do not infer that 60s source checks increase the actual DHMZ publication cadence.
