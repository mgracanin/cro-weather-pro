# Quality gates

## Backend

```bash
cd backend
python3.12 -m venv .venv
pip install -r requirements-dev.txt
python -m pytest -q
python scripts/bootstrap_geo.py --strict
python scripts/bootstrap_station_meta.py
```

Tests cover official published DMS station coordinate parsing, DHMZ XML parsing, missing fields, rejected entity expansion, Haversine distance, normalisation, Croatian settlement lookup and nearest station selection. For a production CI pipeline also mock Redis and DHMZ with integration tests and run real-source contract checks.

## Frontend

```bash
cd frontend
npm install
npm run geo:sync
npm run typecheck
npm run lint
npm run build
```

Run Lighthouse against `npm run start` or the built WSL container. Suggested quality target: Performance ≥90, Accessibility ≥90, Best Practices ≥90, SEO ≥90, on both desktop and mobile under known CPU/network presets. **These numbers are acceptance targets, not claimed benchmark results.**

## Browser acceptance walkthrough

1. No Docker Desktop running; verify all three containers with `wslc container list`.
2. Check landing page on mobile and desktop, both themes.
3. Search `zag` and see Zagreb place plus Zagreb meteorological station variants when available in the DHMZ feed.
4. Search `Samobor`; view the nearest **currently reporting and geocoded** station and its calculated distance. Do not assume a particular station or a pre-written distance.
5. Grant GPS; verify nearest station, refresh status, and clear fallback error for blocked permissions.
6. Map: select different counties with mouse and keyboard, zoom, click station markers.
7. Verify 60-second Redis caching via request logs / metrics; actual source observations may remain unchanged for much longer.
8. Temporarily block DHMZ after first successful fetch; verify a visibly stale snapshot. Clear cache in a test setup; verify a clean 503 with no fake values.
9. Inspect Prometheus `/api/metrics` and Swagger `/docs`.
