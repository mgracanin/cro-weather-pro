"""Croatia-only GeoNames gazetteer, with conservative source-backed station matching."""
import json
import math
import re
import unicodedata
from difflib import SequenceMatcher
from functools import lru_cache
from pathlib import Path

from .models import Location, WeatherObservation

BASE_DIR = Path(__file__).resolve().parents[1]

# Verified/approximate ground coordinates of well-known DHMZ sites. Use only these
# as fallbacks for station aliases, never as the coordinate of an arbitrary place.
STATION_OVERRIDES = {
    'zagreb-maksimir': (45.82, 16.02, 'Grad Zagreb'),
    'zagreb-gric': (45.815, 15.973, 'Grad Zagreb'),
    'zagreb-aerodrom': (45.74, 16.07, 'Grad Zagreb'),
    'zagreb-pleso': (45.74, 16.07, 'Grad Zagreb'),
    'split-marjan': (43.509, 16.426, 'Splitsko-dalmatinska'),
    'split-resnik': (43.538, 16.298, 'Splitsko-dalmatinska'),
    'rijeka-kozala': (45.336, 14.442, 'Primorsko-goranska'),
    'rijeka-omisalj': (45.217, 14.570, 'Primorsko-goranska'),
    'pula-aerodrom': (44.893, 13.922, 'Istarska'),
    'dubrovnik-aerodrom': (42.561, 18.268, 'Dubrovačko-neretvanska'),
    'osijek-klisa': (45.462, 18.810, 'Osječko-baranjska'),
    'zadar-zemunik': (44.108, 15.347, 'Zadarska'),
}


def fold(value: str) -> str:
    value = value.casefold().replace('đ', 'd').replace('Đ', 'd')
    value = unicodedata.normalize('NFKD', value)
    return re.sub(r'[^a-z0-9]+', ' ', ''.join(c for c in value if not unicodedata.combining(c))).strip()


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in kilometres (not a travel distance)."""
    a1, a2 = math.radians(lat1), math.radians(lat2)
    da, dl = a2 - a1, math.radians(lon2 - lon1)
    a = math.sin(da / 2) ** 2 + math.cos(a1) * math.cos(a2) * math.sin(dl / 2) ** 2
    return round(6371.0088 * 2 * math.asin(min(1.0, math.sqrt(a))), 2)


@lru_cache(maxsize=1)
def official_station_index() -> dict[str, tuple[float, float]]:
    registry_path = BASE_DIR / 'data' / 'official_stations.json'
    with registry_path.open(encoding='utf-8') as handle:
        raw = json.load(handle)
    # Ignore the generic 'MM' suffix (automatic observation network).
    # Coordinates remain those of the precise named physical station.
    return {fold(key.removesuffix(' MM')): (float(value[0]), float(value[1])) for key, value in raw.items()}


@lru_cache(maxsize=1)
def locations() -> list[Location]:
    # The GeoNames dataset is embedded into the backend image at build time;
    # local developers can populate it with `python scripts/bootstrap_geo.py`.
    path = BASE_DIR / 'data' / 'locations.json'
    with path.open(encoding='utf-8') as handle:
        result = [Location.model_validate(item) for item in json.load(handle)]
    return result


@lru_cache(maxsize=1)
def location_index() -> dict[str, list[Location]]:
    index: dict[str, list[Location]] = {}
    for entry in locations():
        index.setdefault(fold(entry.name), []).append(entry)
    return index


def match_station(name: str) -> tuple[float | None, float | None, str | None]:
    official = official_station_index().get(fold(name))
    if official is not None:
        local = location_index().get(fold(name), [])
        region = max(local, key=lambda hit: hit.population or 0).region if local else None
        return official[0], official[1], region
    key = fold(name).replace(' ', '-')
    if key in STATION_OVERRIDES:
        return STATION_OVERRIDES[key]
    index = location_index()
    hits = index.get(fold(name))
    if hits:
        best = max(hits, key=lambda hit: hit.population or 0)
        return best.lat, best.lon, best.region
    # Station names frequently include a station suffix. Match unambiguous
    # populated-place names, without pretending an unrelated locality is exact.
    for suffix in (' aerodrom', ' postaja', ' centar', ' meteoroloska', ' luka'):
        normalized = fold(name)
        if normalized.endswith(suffix):
            hits = index.get(normalized.removesuffix(suffix))
            if hits:
                best = max(hits, key=lambda hit: hit.population or 0)
                return best.lat, best.lon, best.region
    return None, None, None


def enrich_station(station: WeatherObservation) -> WeatherObservation:
    lat, lon, region = match_station(station.name)
    return station.model_copy(update={'lat': lat, 'lon': lon, 'region': region})


def closest_station(lat: float, lon: float, stations: list[WeatherObservation]) -> tuple[WeatherObservation, float] | None:
    candidates = [s for s in stations if s.lat is not None and s.lon is not None]
    if not candidates:
        return None
    return min(((s, haversine_distance(lat, lon, s.lat, s.lon)) for s in candidates), key=lambda x: x[1])


def search_places(query: str, limit: int = 12) -> list[tuple[Location, float]]:
    q = fold(query)
    if not q:
        return []
    ranked: list[tuple[Location, float]] = []
    for entry in locations():
        name = fold(entry.name)
        if name == q:
            score = 4.0
        elif name.startswith(q):
            score = 3.0
        elif q in name:
            score = 2.0
        elif len(q) >= 3:
            score = SequenceMatcher(a=q, b=name).ratio()
            if score < 0.69:
                continue
        else:
            continue
        ranked.append((entry, score))
    ranked.sort(key=lambda r: (-r[1], -(r[0].population or 0), r[0].name))
    return ranked[:limit]
