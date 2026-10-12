"""Redis-backed DHMZ fetch policy. One source refresh per 60s, stale-on-error."""
import asyncio
from datetime import datetime, timezone
import logging

import httpx
from defusedxml.common import DefusedXmlException
from xml.etree.ElementTree import ParseError
from redis.asyncio import Redis

from .dhmz import parse_feed
from .geography import enrich_station
from .models import HistoryPoint, WeatherSnapshot, WeatherObservation

logger = logging.getLogger(__name__)
FEED_URL = 'https://vrijeme.hr/hrvatska1_n.xml'
CURRENT_KEY = 'weather:current'
LAST_GOOD_KEY = 'weather:last_good'
LOCK_KEY = 'weather:fetch_lock'
BACKOFF_KEY = 'weather:retry_after_failure'


class WeatherService:
    def __init__(self, redis: Redis, client: httpx.AsyncClient):
        self.redis = redis
        self.client = client
        self._local_lock = asyncio.Lock()
        self.last_error: str | None = None

    async def snapshot(self) -> WeatherSnapshot:
        cached = await self.redis.get(CURRENT_KEY)
        if cached:
            return WeatherSnapshot.model_validate_json(cached)
        async with self._local_lock:
            cached = await self.redis.get(CURRENT_KEY)
            if cached:
                return WeatherSnapshot.model_validate_json(cached)
            # Never retry the upstream on every request during a DHMZ outage.
            if await self.redis.exists(BACKOFF_KEY):
                return await self._last_good_or_raise()
            lock_acquired = await self.redis.set(LOCK_KEY, '1', ex=25, nx=True)
            if not lock_acquired:
                for _ in range(12):
                    await asyncio.sleep(.25)
                    cached = await self.redis.get(CURRENT_KEY)
                    if cached:
                        return WeatherSnapshot.model_validate_json(cached)
                return await self._last_good_or_raise()
            try:
                response = await self.client.get(FEED_URL)
                response.raise_for_status()
                stations = [enrich_station(s) for s in parse_feed(response.content)]
                snapshot = WeatherSnapshot(fetched_at=datetime.now(timezone.utc), source=FEED_URL, stations=stations)
                raw = snapshot.model_dump_json()
                await self.redis.setex(CURRENT_KEY, 60, raw)
                await self.redis.setex(LAST_GOOD_KEY, 86400, raw)
                await self._record_history(stations)
                self.last_error = None
                await self.redis.delete(BACKOFF_KEY)
                return snapshot
            except (httpx.HTTPError, ValueError, ParseError, DefusedXmlException) as exc:
                logger.warning('DHMZ refresh failed: %s', exc)
                self.last_error = str(exc)
                await self.redis.setex(BACKOFF_KEY, 60, '1')
                return await self._last_good_or_raise()
            finally:
                await self.redis.delete(LOCK_KEY)

    async def _last_good_or_raise(self) -> WeatherSnapshot:
        raw = await self.redis.get(LAST_GOOD_KEY)
        if raw:
            return WeatherSnapshot.model_validate_json(raw).model_copy(update={'stale': True})
        raise RuntimeError('DHMZ unavailable and no valid cached observations exist')

    async def _record_history(self, stations: list[WeatherObservation]) -> None:
        # Feed observation time, not the polling time, determines chart points.
        # Redis list writes are deduplicated per station and bounded to 96 readings.
        pipeline = self.redis.pipeline(transaction=False)
        for station in stations:
            if station.observed_at is None:
                continue
            key = f'weather:history:{station.name.casefold()}'
            last_stamp = await self.redis.hget('weather:history:seen', station.name.casefold())
            stamp = station.observed_at.isoformat()
            if last_stamp == stamp:
                continue
            point = HistoryPoint(
                timestamp=station.observed_at,
                temperature_c=station.temperature_c,
                humidity_pct=station.humidity_pct,
                pressure_hpa=station.pressure_hpa,
                wind_speed_ms=station.wind_speed_ms,
            )
            pipeline.lpush(key, point.model_dump_json())
            pipeline.ltrim(key, 0, 95)
            pipeline.expire(key, 14 * 86400)
            pipeline.hset('weather:history:seen', station.name.casefold(), stamp)
        await pipeline.execute()

    async def history(self, station: str) -> list[HistoryPoint]:
        points = await self.redis.lrange(f'weather:history:{station.casefold()}', 0, 95)
        return [HistoryPoint.model_validate_json(raw) for raw in reversed(points)]

    async def feed_freshness(self) -> tuple[str, datetime | None]:
        raw = await self.redis.get(LAST_GOOD_KEY)
        if not raw:
            return 'unavailable', None
        snapshot = WeatherSnapshot.model_validate_json(raw)
        age = (datetime.now(timezone.utc) - snapshot.fetched_at).total_seconds()
        return ('ok' if age <= 180 else 'stale'), snapshot.fetched_at
