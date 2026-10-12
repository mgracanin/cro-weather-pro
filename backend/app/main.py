"""CroWeather Pro – read-only weather API."""
import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, Path, Query, Request
from fastapi.responses import Response
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from redis.asyncio import Redis
from redis.exceptions import RedisError

from .geography import closest_station, fold, search_places
from .models import HealthStatus, HistoryPoint, LocatedWeather, SearchHit, WeatherObservation, WeatherSnapshot
from .weather_service import WeatherService

logging.basicConfig(level=logging.INFO)
REQUESTS = Counter('croweather_http_requests_total', 'HTTP requests', ['route', 'method', 'status'])
LATENCY = Histogram('croweather_http_request_seconds', 'Request duration', ['route'])


@asynccontextmanager
async def lifespan(app: FastAPI):
    cache = Redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379/0'), decode_responses=True, socket_connect_timeout=3)
    client = httpx.AsyncClient(timeout=httpx.Timeout(12, connect=5), follow_redirects=False,
                               headers={'User-Agent': 'CroWeatherPro/1.0 (+https://meteo.hr)'})
    app.state.redis = cache
    app.state.weather = WeatherService(cache, client)
    async def refresh_loop():
        while True:
            try:
                await app.state.weather.snapshot()
            except (RuntimeError, RedisError) as exc:
                logging.getLogger(__name__).warning('Background refresh: %s', exc)
            await asyncio.sleep(60)
    task = asyncio.create_task(refresh_loop())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        await client.aclose()
        await cache.aclose()


app = FastAPI(title='CroWeather Pro API', version='1.0.0', description='DHMZ current observations with Croatia-only geographic resolution.', lifespan=lifespan)


@app.middleware('http')
async def metrics_and_headers(request: Request, call_next):
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        REQUESTS.labels(request.url.path, request.method, '500').inc()
        raise
    route = request.scope.get('route')
    template = getattr(route, 'path', request.url.path)
    REQUESTS.labels(template, request.method, str(response.status_code)).inc()
    LATENCY.labels(template).observe(time.perf_counter() - started)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Cache-Control'] = 'no-store'
    return response


async def _snapshot(request: Request) -> WeatherSnapshot:
    try:
        return await request.app.state.weather.snapshot()
    except RedisError as exc:
        raise HTTPException(status_code=503, detail='Redis is unavailable') from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get('/api/weather', response_model=WeatherSnapshot)
async def all_weather(request: Request):
    return await _snapshot(request)


@app.get('/api/stations', response_model=list[WeatherObservation])
async def stations(request: Request):
    return (await _snapshot(request)).stations


@app.get('/api/station/{name}', response_model=WeatherObservation)
async def station_by_name(request: Request, name: str = Path(min_length=1, max_length=120)):
    for s in (await _snapshot(request)).stations:
        if fold(s.name) == fold(name):
            return s
    raise HTTPException(status_code=404, detail='Station not in current DHMZ feed')


@app.get('/api/location', response_model=LocatedWeather)
async def resolve_location(request: Request, lat: float = Query(ge=42, le=47), lon: float = Query(ge=13, le=20)):
    nearest = closest_station(lat, lon, (await _snapshot(request)).stations)
    if nearest is None:
        raise HTTPException(status_code=503, detail='No station coordinates resolved')
    return LocatedWeather(nearest_station=nearest[0], distance_km=nearest[1])


@app.get('/api/search', response_model=list[SearchHit])
async def search(request: Request, q: str = Query(min_length=1, max_length=100), limit: int = Query(12, ge=1, le=30)):
    candidates = search_places(q, limit=limit)
    # Search should match stations as well, especially Zagreb-Grič variants.
    try:
        snapshot = await _snapshot(request)
    except HTTPException:
        snapshot = None  # Place search works even during a weather-feed outage.
    result: list[SearchHit] = []
    used: set[tuple[str, float, float]] = set()
    for station in snapshot.stations if snapshot is not None else []:
        if station.lat is None or station.lon is None:
            continue
        if fold(q) in fold(station.name) or (len(fold(q)) > 3 and fold(station.name).startswith(fold(q))):
            hit = SearchHit(name=station.name, lat=station.lat, lon=station.lon, region=station.region, category='station')
            result.append(hit)
            used.add((fold(hit.name), hit.lat, hit.lon))
    for loc, _ in candidates:
        ident = (fold(loc.name), loc.lat, loc.lon)
        if ident not in used:
            result.append(SearchHit(name=loc.name, lat=loc.lat, lon=loc.lon, region=loc.region, category=loc.category))
            used.add(ident)
    return result[:limit]


@app.get('/api/history', response_model=list[HistoryPoint])
async def history(request: Request, station: str = Query(min_length=1, max_length=120)):
    try:
        return await request.app.state.weather.history(station)
    except RedisError as exc:
        raise HTTPException(status_code=503, detail='Redis is unavailable') from exc


@app.get('/api/health', response_model=HealthStatus)
async def health(request: Request, response: Response):
    redis_status = 'ok'
    try:
        await request.app.state.redis.ping()
        feed_status, timestamp = await request.app.state.weather.feed_freshness()
        raw = await request.app.state.redis.get('weather:last_good')
        count = len(WeatherSnapshot.model_validate_json(raw).stations) if raw else 0
    except RedisError:
        redis_status, feed_status, timestamp, count = 'unavailable', 'unknown', None, 0
    status = HealthStatus(backend='ok', redis=redis_status, weather_feed=feed_status, last_success=timestamp, station_count=count)
    if redis_status != 'ok' or feed_status != 'ok':
        response.status_code = 503
    return status


@app.get('/api/metrics', include_in_schema=True)
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get('/', include_in_schema=False)
async def root():
    return {'application': 'CroWeather Pro API', 'docs': '/docs', 'source': 'DHMZ'}
