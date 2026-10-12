"use client";
import { useEffect, useMemo, useState } from "react";
import { geoMercator, geoPath, geoCentroid } from "d3-geo";
import type { Feature, FeatureCollection, Geometry, GeoJsonProperties, Position } from "geojson";
import { MapPin, Plus, Minus, Layers, Compass } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { WeatherStation } from "@/lib/types";
import { Button } from "@/components/ui/button";

type County = Feature<Geometry, GeoJsonProperties>;
const WIDTH = 900, HEIGHT = 585;

function normalizeRing(ring: Position[], clockwise: boolean): Position[] {
  let area = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    area += current[0] * next[1] - next[0] * current[1];
  }
  const isClockwise = area < 0;
  return isClockwise === clockwise ? ring : [...ring].reverse();
}

function normalizeWinding(collection: FeatureCollection<Geometry>): FeatureCollection<Geometry> {
  return {
    ...collection,
    features: collection.features.map(feature => {
      const geometry = feature.geometry;
      if (geometry.type === "Polygon") {
        return {
          ...feature,
          geometry: {
            ...geometry,
            coordinates: geometry.coordinates.map((ring, index) => normalizeRing(ring, index === 0)),
          },
        };
      }
      if (geometry.type === "MultiPolygon") {
        return {
          ...feature,
          geometry: {
            ...geometry,
            coordinates: geometry.coordinates.map(polygon =>
              polygon.map((ring, index) => normalizeRing(ring, index === 0))),
          },
        };
      }
      return feature;
    }),
  };
}

export function CroatiaMap({ stations, selected, onSelect, onCoordinate }: {
  stations: WeatherStation[];
  selected: string | null;
  onSelect: (station: WeatherStation) => void;
  onCoordinate: (lat: number, lon: number, county: string) => void;
}) {
  const [geometry, setGeometry] = useState<FeatureCollection<Geometry> | null>(null);
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [hovered, setHovered] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/counties.geojson", { signal: controller.signal }).then(r => { if (!r.ok) throw new Error("Map geometry unavailable"); return r.json(); })
      .then((body: FeatureCollection<Geometry>) => { if (body.type !== 'FeatureCollection') throw new Error('Invalid map'); setGeometry(normalizeWinding(body)); })
      .catch(e => { if (e.name !== "AbortError") setError(true); });
    return () => controller.abort();
  }, []);
  const projection = useMemo(() => geometry ? geoMercator().fitExtent([[38,28],[WIDTH-38,HEIGHT-30]], geometry) : null, [geometry]);
  const path = useMemo(() => projection ? geoPath(projection) : null, [projection]);
  const placed = useMemo(() => stations.flatMap(s => {
    if (!projection || s.lat === null || s.lon === null) return [];
    const xy = projection([s.lon, s.lat]);
    return xy ? [{...s, x: xy[0], y: xy[1]}] : [];
  }), [projection, stations]);
  return <Card className="relative overflow-hidden p-4 sm:p-6 h-full">
    <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
      <div><p className="card-kicker mb-2">Interaktivni zemljovid</p><h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Hrvatska izbliza</h2><p className="muted text-xs mt-2">Odaberite meteorološku postaju ili županiju</p></div>
      <div className="flex gap-2"><Button aria-label="Umanji zemljovid" variant="secondary" size="icon" disabled={zoom <= 1} onClick={()=>setZoom(z=>Math.max(1,z-.25))}><Minus size={16}/></Button><Button aria-label="Povećaj zemljovid" variant="secondary" size="icon" disabled={zoom >= 2.75} onClick={()=>setZoom(z=>Math.min(2.75,z+.25))}><Plus size={16}/></Button></div>
    </div>
    <div className="relative mt-3 w-full min-h-[230px] sm:min-h-[300px] aspect-[900/585]">
      {error ? <div className="absolute inset-0 flex flex-col items-center justify-center muted gap-3 text-center"><Layers size={25}/><p>Zemljovid županija trenutačno nije dostupan.</p></div> : !geometry ? <div className="absolute inset-0 flex justify-center items-center muted text-sm animate-pulse">Učitavanje zemljovida…</div> :
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="absolute inset-0 w-full h-full" role="group" aria-label="Interaktivni zemljovid hrvatskih županija i meteoroloških postaja">
        <defs><linearGradient id="countyShade" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#1b7bad" stopOpacity=".36"/><stop offset="1" stopColor="#3761c9" stopOpacity=".14"/></linearGradient><filter id="glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <g transform={`translate(${WIDTH/2 - zoom*WIDTH/2} ${HEIGHT/2 - zoom*HEIGHT/2}) scale(${zoom})`} style={{transition:"transform .35s ease-out"}}>
          {geometry.features.map((feature: County, index: number) => {
            const label = String(feature.properties?.shapeName ?? feature.properties?.NAME_1 ?? feature.properties?.name ?? `Županija ${index+1}`);
            const center = geoCentroid(feature);
            return <path key={String(feature.properties?.shapeID ?? index)} d={path?.(feature) ?? ""} fill={hovered===label ? "rgba(56,189,248,.42)" : "url(#countyShade)"} stroke="rgba(112,193,241,.46)" strokeWidth={1.4 / zoom} className="cursor-pointer transition-colors" role="button" tabIndex={0} aria-label={`Prikaži najbližu postaju u županiji ${label}`} onMouseEnter={()=>setHovered(label)} onMouseLeave={()=>setHovered("")} onClick={()=>onCoordinate(center[1], center[0], label)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onCoordinate(center[1],center[0],label);}}}><title>{label}</title></path>;
          })}
          {placed.map(station => {
            const active = selected === station.name;
            return <g key={station.name} className="cursor-pointer" role="button" tabIndex={0} aria-label={`Prikaži podatke za postaju ${station.name}`} onClick={()=>onSelect(station)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(station);}}}>
              <circle cx={station.x} cy={station.y} r={active?14/zoom:9/zoom} fill={active?"#fbbf24":"#0ea5e9"} opacity={.22} />
              <circle cx={station.x} cy={station.y} r={active?6/zoom:3.3/zoom} fill={active?"#fde68a":"#e0f2fe"} stroke={active?"#f59e0b":"#1586cc"} strokeWidth={1.4/zoom} filter={active?"url(#glow)":undefined} />
              <title>{station.name}{station.temperature_c === null ? '' : ` · ${station.temperature_c}°C`}</title>
            </g>;
          })}
        </g>
      </svg>}
    </div>
    <div className="mt-2 pt-3 border-t border-white/10 flex flex-wrap justify-between gap-3 text-xs muted"><span className="flex items-center gap-2"><MapPin size={14}/> {placed.length} postaja s poznatim koordinatama</span><span className="flex items-center gap-2"><Compass size={14}/> {hovered || "21 županija"}</span></div>
  </Card>;
}
