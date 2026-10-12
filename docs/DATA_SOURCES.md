# Data sources and legal attribution

## DHMZ

Observation feed: https://vrijeme.hr/hrvatska1_n.xml
Published dataset index: https://www.meteo.hr/proizvodi.php?param=xml_korisnici&section=podaci

The Croatian Meteorological and Hydrological Service permits reuse under the Open Licence of the Republic of Croatia with **mandatory source attribution**. The page/footer consistently credit DHMZ. Weather observations are not guaranteed to change every minute; station updates are generally hourly and may contain missing sensor fields.

## GeoNames

Country dump: https://download.geonames.org/export/dump/HR.zip
Administrative divisions: https://download.geonames.org/export/dump/admin1CodesASCII.txt
Licence: CC BY 4.0. Credit [GeoNames](https://www.geonames.org/).

Only Croatia's populated places and ADM1–ADM3 regions are parsed; preserve duplicate settlement names (coordinates distinguish them). Importer lives at `backend/scripts/bootstrap_geo.py`. All third-party data may contain inaccuracies; do not claim municipal legal status without an independent state register check.

## geoBoundaries

API: https://www.geoboundaries.org/api/current/gbOpen/HRV/ADM1/
Licence: gbOpen CC BY 4.0; credit [geoBoundaries](https://www.geoboundaries.org/).

At build time the frontend retrieves the published ADM1 Croatia county polygons; JavaScript renders real boundaries in a clickable SVG with d3-geo. If the upstream dataset is unreachable, first build fails rather than render invented boundaries.

## Official station coordinates (NN 5/2026)

Croatian Government Decision published January 15, 2026: https://narodne-novine.nn.hr/clanci/sluzbeni/2026_01_5_30.html . The bundled `official_stations.json` contains coordinate examples verified from this published table. `backend/scripts/bootstrap_station_meta.py` downloads and parses the complete official meteorological network tables during the container build; parsed degrees/minutes/seconds are converted to decimal degrees. Exact matching takes priority over GeoNames town-center approximations. For unresolved stations, the API returns `null` coordinates, never a made-up value.
