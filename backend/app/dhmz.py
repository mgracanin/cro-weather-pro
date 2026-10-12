"""Safe and loss-tolerant parser for DHMZ region-grouped XML observations."""
from datetime import datetime, timezone
import re
from zoneinfo import ZoneInfo
from defusedxml import ElementTree as ET
from xml.etree.ElementTree import Element
from .models import WeatherObservation

TZ = ZoneInfo('Europe/Zagreb')


def _text(element: Element | None, *tags: str) -> str | None:
    if element is None:
        return None
    for tag in tags:
        child = element.find(tag)
        if child is not None and child.text and child.text.strip() not in ('-', '--', '—', 'N/A'):
            return child.text.strip()
    return None


def _number(value: str | None) -> float | None:
    if not value:
        return None
    match = re.search(r'-?\d+(?:[.,]\d+)?', value)
    return float(match.group(0).replace(',', '.')) if match else None


def _timestamp(root: Element) -> datetime | None:
    node = root.find('.//DatumTermin')
    date = _text(node, 'Datum')
    time = _text(node, 'Termin') or '00'
    if not date:
        return None
    date = date.rstrip('.')
    time = time.replace('h', '').strip()
    if ':' not in time:
        time = f'{time}:00'
    for pattern in ('%d.%m.%Y %H:%M', '%Y-%m-%d %H:%M'):
        try:
            return datetime.strptime(f'{date} {time}', pattern).replace(tzinfo=TZ).astimezone(timezone.utc)
        except ValueError:
            pass
    return None


def parse_feed(payload: bytes) -> list[WeatherObservation]:
    if len(payload) > 2_000_000:
        raise ValueError('DHMZ payload exceeds 2MB limit')
    root = ET.fromstring(payload)
    observed = _timestamp(root)
    stations: dict[str, WeatherObservation] = {}
    for node in root.findall('.//Grad'):
        name = _text(node, 'GradIme', 'Ime')
        if not name:
            continue
        data = node.find('Podatci')
        if data is None:
            data = node
        # DHMZ can omit fields for individual stations. Never invent values.
        obs = WeatherObservation(
            name=name,
            observed_at=observed,
            temperature_c=_number(_text(data, 'Temp', 'Temperatura')),
            humidity_pct=_number(_text(data, 'Vlaga', 'RelVlaznost')),
            pressure_hpa=_number(_text(data, 'Tlak', 'TlakZraka')),
            wind_speed_ms=_number(_text(data, 'VjetarBrzina', 'Vjetar')),
            wind_direction=_text(data, 'VjetarSmjer'),
            conditions=_text(data, 'Vrijeme', 'Opis'),
        )
        stations[name.casefold()] = obs
    if not stations:
        raise ValueError('No Grad/GradIme observations found in DHMZ XML')
    return sorted(stations.values(), key=lambda s: s.name)
