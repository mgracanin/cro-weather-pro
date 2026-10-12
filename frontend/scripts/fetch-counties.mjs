/* Build-time acquisition of real (not fabricated) county outlines.
 * Data: geoBoundaries gbOpen HRV ADM1 (CC BY 4.0), 21 regions.
 * API and file shape: https://www.geoboundaries.org/api.html
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
const api = 'https://www.geoboundaries.org/api/current/gbOpen/HRV/ADM1/';
const target = new URL('../public/data/counties.geojson', import.meta.url);
async function main() {
  try {
    const meta = await fetch(api, { signal: AbortSignal.timeout(20000) });
    if (!meta.ok) throw new Error(`geoBoundaries API ${meta.status}`);
    const info = await meta.json();
    const url = info.simplifiedGeometryGeoJSON || info.gjDownloadURL;
    if (typeof url !== 'string' || !url.startsWith('https://')) throw new Error('Missing HTTPS GeoJSON URL');
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`GeoJSON ${response.status}`);
    const body = await response.json();
    if (body.type !== 'FeatureCollection' || !Array.isArray(body.features) || body.features.length < 20) throw new Error('Invalid Croatia county geometry');
    await mkdir(new URL('../public/data/', import.meta.url), { recursive: true });
    await writeFile(target, JSON.stringify(body));
    console.log(`Saved ${body.features.length} real Croatian county geometries`);
  } catch (error) {
    try {
      const existing = JSON.parse(await readFile(target, 'utf8'));
      if (existing.type === 'FeatureCollection' && existing.features.length >= 20) {
        console.warn('Using last known geoBoundaries geometry:', String(error));
        return;
      }
    } catch { /* no local map snapshot */ }
    throw new Error(`County map download failed. Network required for first build: ${error}`);
  }
}
await main();
