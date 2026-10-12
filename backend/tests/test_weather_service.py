"""Run with requirements-dev.txt: uses an in-process fake Redis and a mocked DHMZ."""
import pytest
import httpx
import fakeredis.aioredis

from app.weather_service import WeatherService, CURRENT_KEY

XML = b'''<Hrvatska><DatumTermin><Datum>08.10.2026.</Datum><Termin>14</Termin></DatumTermin>
<Gradovi><Grad><GradIme>Zagreb-Maksimir</GradIme><Podatci><Temp>20.1</Temp><Vlaga>62</Vlaga></Podatci></Grad></Gradovi></Hrvatska>'''


@pytest.mark.asyncio
async def test_redis_cache_and_real_observation_history():
    redis = fakeredis.aioredis.FakeRedis(decode_responses=True)
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, content=XML)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        service = WeatherService(redis, client)
        first = await service.snapshot()
        second = await service.snapshot()
        assert len(first.stations) == 1
        assert first.stations[0].lat is not None
        assert len(await service.history('Zagreb-Maksimir')) == 1
        assert first.model_dump() == second.model_dump()
        assert calls == 1
        await redis.delete(CURRENT_KEY)
        await service.snapshot()
        assert calls == 2
        # Same source observation should not produce another chart sample.
        assert len(await service.history('Zagreb-Maksimir')) == 1
    await redis.aclose()


@pytest.mark.asyncio
async def test_feed_failure_stale_fallback_and_backoff():
    redis = fakeredis.aioredis.FakeRedis(decode_responses=True)
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls > 1:
            return httpx.Response(503)
        return httpx.Response(200, content=XML)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        service = WeatherService(redis, client)
        await service.snapshot()
        await redis.delete(CURRENT_KEY)
        stale = await service.snapshot()
        assert stale.stale is True
        await service.snapshot()
        assert calls == 2  # Backoff blocks request storms during outage.
    await redis.aclose()
