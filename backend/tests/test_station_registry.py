from scripts.bootstrap_station_meta import dms_to_decimal, parse_registry
from app.geography import match_station


def test_official_dms_parser():
    html = '''<table><tr><th>Redni broj</th><th>Naziv postaje</th><th>Lat</th><th>Lon</th></tr>
    <tr><td>1</td><td>Zagreb – Maksimir</td><td>45° 49’ 18.69’’</td><td>16° 02’ 00.99’’</td></tr></table>'''
    registry = parse_registry(html)
    assert 'Zagreb – Maksimir' in registry
    assert 45.82 < registry['Zagreb – Maksimir'][0] < 45.83
    assert 16.03 < registry['Zagreb – Maksimir'][1] < 16.04


def test_known_official_station_preferred():
    lat, lon, region = match_station('Zagreb-Maksimir')
    assert lat is not None and 45.82 < lat < 45.83
    assert lon is not None and 16.03 < lon < 16.04
