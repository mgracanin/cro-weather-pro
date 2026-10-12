#!/usr/bin/env python3
"""Harvest official Croatian meteo station coordinates from NN 5/2026.

Source: https://narodne-novine.nn.hr/clanci/sluzbeni/2026_01_5_30.html
The government decision's station tables provide DMS coordinates; no geocoding
or guessed station points are used. The generated JSON is a build artefact.
"""
import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen

SOURCE = 'https://narodne-novine.nn.hr/clanci/sluzbeni/2026_01_5_30.html'
BASE = Path(__file__).resolve().parents[1]


class TableRows(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows: list[list[str]] = []
        self.row: list[str] | None = None
        self.cell: list[str] | None = None

    def handle_starttag(self, tag: str, attrs):
        if tag == 'tr':
            self.row = []
        elif tag in ('td', 'th') and self.row is not None:
            self.cell = []

    def handle_data(self, data: str):
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag: str):
        if tag in ('td', 'th') and self.cell is not None and self.row is not None:
            self.row.append(' '.join(' '.join(self.cell).split()))
            self.cell = None
        elif tag == 'tr' and self.row is not None:
            if len(self.row) >= 4:
                self.rows.append(self.row)
            self.row = None
            self.cell = None


def dms_to_decimal(text: str, lat: bool) -> float | None:
    parts = re.findall(r'\d+(?:[.,]\d+)?', text)
    if len(parts) < 2 or '°' not in text:
        return None
    degrees, minutes = float(parts[0].replace(',', '.')), float(parts[1].replace(',', '.'))
    seconds = float(parts[2].replace(',', '.')) if len(parts) > 2 else 0
    value = round(degrees + minutes / 60 + seconds / 3600, 6)
    if not (42 <= value <= 47 if lat else 13 <= value <= 20):
        return None
    return value


def parse_registry(html: str) -> dict[str, list[float]]:
    parser = TableRows()
    parser.feed(html)
    stations: dict[str, list[float]] = {}
    for row in parser.rows:
        if len(row) < 4:
            continue
        lat = dms_to_decimal(row[2], True)
        lon = dms_to_decimal(row[3], False)
        name = row[1].strip()
        if lat is None or lon is None or not name or name.lower() in ('naziv postaje', 'naziv'):
            continue
        # The first entry often comes from the conventional main-station
        # network. Later duplicate network entries are retained only if a new
        # name was recorded; never average different physical station sites.
        stations.setdefault(name, [lat, lon])
    return stations


def build(output: Path, strict: bool) -> int:
    try:
        req = Request(SOURCE, headers={'User-Agent': 'CroWeatherPro/1.0'})
        with urlopen(req, timeout=35) as response:
            html = response.read(7_000_000).decode('utf-8', errors='replace')
        registry = parse_registry(html)
        if len(registry) < 50:
            raise ValueError(f'Only {len(registry)} coordinate pairs parsed from official gazette')
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(registry, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        return len(registry)
    except (OSError, ValueError) as exc:
        if strict:
            raise RuntimeError('Official station registry download/parse failed') from exc
        print(f'WARNING: Official station registry unavailable; retaining shipped metadata. Reason: {exc}')
        with output.open(encoding='utf-8') as fh:
            return len(json.load(fh))


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--strict', action='store_true')
    args = p.parse_args()
    print('Official station coordinate pairs:', build(BASE / 'data' / 'official_stations.json', args.strict))
