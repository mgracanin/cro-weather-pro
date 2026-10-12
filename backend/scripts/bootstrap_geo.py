#!/usr/bin/env python3
"""Reproducibly build Croatia's offline place index from GeoNames public country dump.

GeoNames CC BY 4.0: https://www.geonames.org/export/ . Only HR rows.
Run from the backend folder (also executed at image build).
"""
import argparse
import csv
import io
import json
import logging
from pathlib import Path
import urllib.request
import zipfile

SOURCE = 'https://download.geonames.org/export/dump/HR.zip'
ADMIN = 'https://download.geonames.org/export/dump/admin1CodesASCII.txt'
BASE = Path(__file__).resolve().parents[1]


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={'User-Agent': 'CroWeatherPro/1.0 (geonames attribution in docs)'})
    with urllib.request.urlopen(request, timeout=35) as response:
        return response.read()


def build(seed: Path, output: Path, strict: bool = False) -> int:
    with seed.open(encoding='utf-8') as fh:
        places = json.load(fh)
    try:
        raw = fetch(SOURCE)
        admin_txt = fetch(ADMIN).decode('utf-8')
        admin_map = {r[0]: r[1] for r in csv.reader(io.StringIO(admin_txt), delimiter='\t') if len(r) >= 2}
        archive = zipfile.ZipFile(io.BytesIO(raw))
        rows = csv.reader(io.StringIO(archive.read('HR.txt').decode('utf-8')), delimiter='\t')
        count = 0
        identities = {(r['name'].casefold(), round(r['lat'], 4), round(r['lon'], 4)) for r in places}
        for row in rows:
            if len(row) < 19 or row[8] != 'HR':
                continue
            kind, code = row[6], row[7]
            if kind == 'P':
                category = 'settlement'
            elif kind == 'A' and code in ('ADM2', 'ADM3'):
                category = 'municipality'
            elif kind == 'A' and code == 'ADM1':
                category = 'county'
            else:
                continue
            try:
                lat, lon, pop = float(row[4]), float(row[5]), int(row[14] or 0)
            except ValueError:
                continue
            if not (42 <= lat <= 47 and 13 <= lon <= 20):
                continue
            name = row[1].strip()
            key = (name.casefold(), round(lat, 4), round(lon, 4))
            if key in identities:
                continue
            places.append({'name': name, 'lat': lat, 'lon': lon, 'region': admin_map.get('HR.' + row[10]), 'category': category, 'population': pop})
            identities.add(key)
            count += 1
        logging.warning('Imported %d GeoNames places (total %d)', count, len(places))
    except (OSError, ValueError, zipfile.BadZipFile, KeyError) as exc:
        if strict:
            raise RuntimeError('GeoNames download failed; full index unavailable') from exc
        logging.warning('GeoNames temporarily unavailable, curated seed only: %s', exc)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(sorted(places, key=lambda row: row['name'].casefold()), ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    return len(places)


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--strict', action='store_true', help='Require full GeoNames dataset; recommended for publication')
    args = p.parse_args()
    print('Locations:', build(BASE / 'data' / 'seed_locations.json', BASE / 'data' / 'locations.json', args.strict))
