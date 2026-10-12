from datetime import datetime
from pydantic import BaseModel, Field


class Location(BaseModel):
    name: str
    lat: float
    lon: float
    region: str | None = None
    category: str = 'settlement'
    population: int | None = None


class WeatherObservation(BaseModel):
    name: str
    lat: float | None = None
    lon: float | None = None
    region: str | None = None
    observed_at: datetime | None = None
    temperature_c: float | None = None
    humidity_pct: float | None = None
    pressure_hpa: float | None = None
    wind_speed_ms: float | None = None
    wind_direction: str | None = None
    conditions: str | None = None


class WeatherSnapshot(BaseModel):
    fetched_at: datetime
    source: str
    stale: bool = False
    stations: list[WeatherObservation]


class LocatedWeather(BaseModel):
    requested: Location | None = None
    nearest_station: WeatherObservation
    distance_km: float = Field(ge=0)
    attribution: str = 'DHMZ – Državni hidrometeorološki zavod'


class HistoryPoint(BaseModel):
    timestamp: datetime
    temperature_c: float | None = None
    humidity_pct: float | None = None
    pressure_hpa: float | None = None
    wind_speed_ms: float | None = None


class SearchHit(BaseModel):
    name: str
    lat: float
    lon: float
    region: str | None = None
    category: str
    distance_km: float | None = None


class HealthStatus(BaseModel):
    backend: str
    redis: str
    weather_feed: str
    last_success: datetime | None = None
    station_count: int = 0
