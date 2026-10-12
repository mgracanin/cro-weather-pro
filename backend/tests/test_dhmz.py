from datetime import timezone
from app.dhmz import parse_feed
from app.geography import fold, haversine_distance, search_places, closest_station
from app.models import WeatherObservation

XML = '''<?xml version="1.0" encoding="UTF-8"?>
<Hrvatska><DatumTermin><Datum>08.10.2026.</Datum><Termin>14</Termin></DatumTermin>
<Gradovi><Grad><GradIme>Zagreb-Maksimir</GradIme><Podatci>
<Temp>17,2</Temp><Vlaga>68</Vlaga><Tlak>1017.3</Tlak>
<VjetarSmjer>SW</VjetarSmjer><VjetarBrzina>3.4</VjetarBrzina><Vrijeme>pretežno oblačno</Vrijeme>
</Podatci></Grad><Grad><GradIme>Osijek</GradIme><Podatci><Temp>-1.0</Temp></Podatci></Grad></Gradovi></Hrvatska>'''.encode()


def test_parse_xml_with_nulls():
    rows = parse_feed(XML)
    assert len(rows) == 2
    zagreb = next(r for r in rows if r.name == 'Zagreb-Maksimir')
    assert zagreb.temperature_c == 17.2
    assert zagreb.humidity_pct == 68
    assert zagreb.observed_at.tzinfo == timezone.utc
    assert zagreb.observed_at.hour == 12
    assert next(r for r in rows if r.name == 'Osijek').pressure_hpa is None


def test_empty_or_malicious_xml_rejected():
    from pytest import raises
    with raises(ValueError):
        parse_feed(b'<Hrvatska/>')
    with raises(Exception):
        parse_feed(b'<!DOCTYPE foo [<!ENTITY x SYSTEM "file:///etc/passwd">]><foo>&x;</foo>')


def test_haversine():
    assert haversine_distance(45.8, 16, 45.8, 16) == 0
    assert 10 < haversine_distance(45.8, 16, 45.9, 16.1) < 20


def test_search_ascii_and_nearest():
    assert fold('Šibenik') == 'sibenik'
    assert any(item.name == 'Samobor' for item, _ in search_places('samo'))
    winner = closest_station(45.8, 16, [WeatherObservation(name='Zagreb', lat=45.82, lon=16.02), WeatherObservation(name='Split', lat=43.5, lon=16.4)])
    assert winner is not None and winner[0].name == 'Zagreb'
