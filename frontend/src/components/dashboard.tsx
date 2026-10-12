"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import {
  CloudSun, Cloud, CloudRain, CloudSnow, Sun, CloudLightning, CloudFog,
  Droplets, Gauge, Wind, Thermometer, MapPinned, LocateFixed, Moon, SunMoon,
  RefreshCw, Clock3, ArrowUpRight, ChevronRight, Radio, Compass, MapPin,
  AlertCircle, Activity, Layers3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CroatiaMap } from "@/components/croatia-map";
import { PlaceSearch } from "@/components/search";
import { dateLabel, formatNumber } from "@/lib/utils";
import type { Snapshot, WeatherStation, SearchHit, HistoryPoint, ResolvedLocation } from "@/lib/types";

const WeatherCharts = dynamic(() => import("@/components/weather-charts"), { ssr: false, loading: () => <div className="glass-panel rounded-3xl h-44 animate-pulse"/> });

function WeatherIcon({condition, size = 70}: {condition: string | null; size?: number}) {
  const c = (condition ?? '').toLocaleLowerCase('hr-HR');
  const props = { size, strokeWidth: 1.35 };
  if (/grmljav|oluja/.test(c)) return <CloudLightning {...props} className="text-yellow-300"/>;
  if (/snijeg|susnje/.test(c)) return <CloudSnow {...props} className="text-sky-200"/>;
  if (/kiš|pljus|rosul/.test(c)) return <CloudRain {...props} className="text-sky-300"/>;
  if (/magl|sumag/.test(c)) return <CloudFog {...props} className="text-slate-300"/>;
  if (/djelom|umjeren|promjen/.test(c)) return <CloudSun {...props} className="text-amber-200"/>;
  if (/oblač|oblac|oblacno/.test(c)) return <Cloud {...props} className="text-slate-200"/>;
  if (/vedro|sunč|sunc/.test(c)) return <Sun {...props} className="text-amber-300"/>;
  return <CloudSun {...props} className="text-sky-200"/>;
}

type Metric = { name: string; value: string; unit: string; icon: typeof Thermometer; tone: string; hint: string };
function buildMetrics(s: WeatherStation): Metric[] {
  return [
    {name: 'Temperatura', value: formatNumber(s.temperature_c, 1), unit: '°C', icon: Thermometer, tone: 'text-amber-400', hint: 'Zrak · u hladu'},
    {name: 'Vlažnost zraka', value: formatNumber(s.humidity_pct), unit: '%', icon: Droplets, tone: 'text-sky-400', hint: 'Relativna vlažnost'},
    {name: 'Tlak zraka', value: formatNumber(s.pressure_hpa, 1), unit: 'hPa', icon: Gauge, tone: 'text-violet-400', hint: 'Izmjereni tlak'},
    {name: 'Brzina vjetra', value: formatNumber(s.wind_speed_ms, 1), unit: 'm/s', icon: Wind, tone: 'text-emerald-400', hint: s.wind_direction ? `Smjer ${s.wind_direction}` : 'Smjer nije dostupan'},
    {name: 'Vremenske prilike', value: s.conditions || '—', unit: '', icon: CloudSun, tone: 'text-rose-300', hint: 'Opis vremena'},
  ];
}

export function Dashboard({initial}: {initial: Snapshot | null}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(initial);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [requestedPlace, setRequestedPlace] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  const stations = useMemo(() => snapshot?.stations ?? [], [snapshot]);
  const station = useMemo(() => stations.find(s => s.name === selectedName) ?? stations.find(s => /zagreb-maksimir/i.test(s.name)) ?? stations.find(s => s.temperature_c !== null) ?? stations[0] ?? null, [selectedName, stations]);
  const currentName = station?.name ?? null;

  useEffect(() => { setMounted(true); }, []);
  const reload = useCallback(async (signal?: AbortSignal) => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/weather', { cache: 'no-store', signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as Snapshot;
      setSnapshot(data);
      setMessage(data.stale ? 'Prikazuju se posljednji dostupni podaci jer DHMZ trenutačno nije dostupan.' : null);
    } catch {
      if (signal?.aborted) return;
      setMessage('Nije moguće dohvatiti podatke. Provjerite stanje sustava i pokušajte ponovno.');
    } finally { if (!signal?.aborted) setRefreshing(false); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (!initial) void reload(controller.signal);
    const timer = window.setInterval(() => void reload(controller.signal), 60000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [initial, reload]);

  useEffect(() => {
    if (!currentName) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/history?station=${encodeURIComponent(currentName!)}`, { signal: controller.signal });
        if (response.ok) setHistory(await response.json() as HistoryPoint[]);
      } catch { /* Preserve most recent successful history. */ }
    }
    void load();
    const timer = window.setInterval(() => void load(), 60000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [currentName]);

  const selectStation = useCallback((s: WeatherStation) => {
    setSelectedName(s.name); setRequestedPlace(null); setDistance(null); setMessage(null);
  }, []);

  const locate = useCallback(async (lat: number, lon: number, label?: string) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < 42 || lat > 47 || lon < 13 || lon > 20) {
      setMessage('Lokacija je izvan Hrvatske. Pretražite mjesto u Hrvatskoj ili odaberite meteorološku postaju.');
      return;
    }
    try {
      const res = await fetch(`/api/location?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const match = (await res.json()) as ResolvedLocation;
      setSelectedName(match.nearest_station.name);
      setRequestedPlace(label ?? 'Vaša lokacija');
      setDistance(match.distance_km);
      setMessage(null);
    } catch {     setMessage('Podaci najbliže postaje trenutačno nisu dostupni.'); }
  }, []);
  const choosePlace = useCallback((hit: SearchHit) => {
    if (hit.category === 'station') {
      const known = stations.find(s => s.name === hit.name);
      if (known) { selectStation(known); return; }
    }
    void locate(hit.lat, hit.lon, hit.name);
  }, [locate, selectStation, stations]);

  const geolocate = useCallback(() => {
    if (!navigator.geolocation) { setMessage('Ovaj preglednik ne podržava geolokaciju.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      position => { setLocating(false);void locate(position.coords.latitude, position.coords.longitude); },
      () => { setLocating(false);setMessage('Lokacija nije dostupna ili pristup nije dopušten. Pretražite mjesto u Hrvatskoj.'); },
      {enableHighAccuracy: false, timeout: 10000, maximumAge: 600000},
    );
  }, [locate]);
  useEffect(() => {
    // Do not surprise users with permission prompts; auto-locate if already granted.
    if (!mounted || !('permissions' in navigator)) return;
    navigator.permissions.query({name: 'geolocation'}).then(status => {
      if (status.state === 'granted') geolocate();
    }).catch(()=>{});
  }, [mounted, geolocate]);

  const metrics = station ? buildMetrics(station) : [];
  const activeCount = stations.filter(s => s.lat !== null && s.lon !== null).length;
  const featured = useMemo(() => {
    const byCity = ['Zagreb-Maksimir','Split-Marjan','Rijeka','Osijek','Zadar','Dubrovnik'];
    return byCity.map(name => stations.find(s => s.name.toLocaleLowerCase('hr-HR') === name.toLocaleLowerCase('hr-HR'))).filter((s): s is WeatherStation=>Boolean(s));
  }, [stations]);

  return <div className="relative min-h-screen isolate overflow-hidden"><div className="weather-ambient" aria-hidden="true"/>
    <div className="mx-auto max-w-[1500px] px-4 sm:px-7 lg:px-12 pb-14">
      <header className="flex items-center justify-between gap-4 py-6 lg:py-8">
        <div className="flex items-center gap-3"><div className="flex items-center justify-center rounded-[17px] h-12 w-12 bg-gradient-to-br from-sky-400 to-indigo-600 shadow-[0_10px_30px_rgba(14,165,233,.28)]"><CloudSun size={26} className="text-white"/></div><div><div className="font-black tracking-[-.055em] text-[21px] leading-tight">CroWeather<span className="text-sky-400"> Pro</span></div><div className="muted text-[10px] tracking-[.16em] uppercase font-bold">Domaće vrijeme iz DHMZ-a</div></div></div>
        <nav className="flex items-center gap-3" aria-label="Glavna navigacija">
          <span className="hidden md:flex items-center gap-2 text-xs muted"><span className="cloud-dot"/> {snapshot?.stale ? 'DHMZ · Spremljeni podaci' : snapshot ? 'DHMZ · Aktualni podaci' : 'DHMZ · Učitavanje'}</span>
          <Button size="icon" variant="secondary" aria-label="Promijeni svijetlu/tamnu temu" onClick={()=>setTheme(theme === 'dark' ? 'light' : 'dark')}>{mounted && theme === 'dark' ? <SunMoon size={18}/> : <Moon size={18}/>}</Button>
          <a className="hidden sm:flex items-center gap-1.5 text-sm muted hover:text-sky-400 transition-colors" href="http://localhost:8000/docs" target="_blank" rel="noreferrer">API <ArrowUpRight size={15}/></a>
        </nav>
      </header>

      <div className="border-t border-white/10 pt-9 sm:pt-14">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-8">
          <div className="max-w-3xl">
            <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-sky-400 font-bold tracking-[.14em] uppercase text-[10px] mb-6"><Radio size={13}/> Meteorološke postaje diljem Hrvatske · Podaci DHMZ-a</motion.div>
            <h1 className="font-semibold tracking-[-.065em] text-[44px] leading-[1.05] sm:text-[64px] lg:text-[76px]">Vrijeme u Hrvatskoj.<span className="block bg-gradient-to-r from-sky-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">Izvor DHMZ.</span></h1>
            <p className="muted text-base sm:text-lg mt-5 leading-relaxed max-w-xl">CroWeather Pro prikazuje aktualna mjerenja DHMZ-a, interaktivni zemljovid te podatke najbliže meteorološke postaje za svako mjesto u Hrvatskoj.</p><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] muted uppercase tracking-[.13em] font-semibold"><span>Aktualni podaci za Hrvatsku</span><span>Pokreće WSL Containers</span></div>
          </div>
          <div className="xl:min-w-[420px] flex flex-col gap-3"><PlaceSearch onSelect={choosePlace}/><Button variant="secondary" className="w-fit" onClick={geolocate} disabled={locating}><LocateFixed size={17} className={locating?'animate-pulse':''}/>{locating?'Određivanje lokacije…':'Vrijeme na mojoj lokaciji'}<ChevronRight size={16}/></Button></div>
        </div>
      </div>

      {message && <div role="status" className="mt-8 glass-panel p-3 px-5 rounded-xl border-amber-500/20 text-sm flex gap-3 items-center"><AlertCircle size={17} className="text-amber-400 shrink-0"/>{message}<Button variant="ghost" size="sm" className="ml-auto" onClick={()=>void reload()}>Pokušaj ponovno</Button></div>}
      {!station ? <Card className="mt-10 p-10 text-center"><Cloud size={42} className="mx-auto text-sky-400 mb-4"/><h2 className="text-2xl font-semibold">Mjerenja trenutačno nisu dostupna</h2><p className="muted mt-3 mb-5">DHMZ nije dostupan ili još nema spremljenih podataka. Ovdje se prikazuju samo stvarna mjerenja.</p><Button onClick={()=>void reload()}><RefreshCw size={16}/> Osvježi podatke</Button></Card> : <>
        <main className="mt-9 grid grid-cols-1 xl:grid-cols-[minmax(0,1.16fr)_minmax(340px,.84fr)] gap-5">
          <motion.section layout className="relative glass-panel rounded-[30px] overflow-hidden min-h-[320px] sm:min-h-[365px]" aria-label="Aktualno vrijeme">
            <div className="absolute top-0 right-0 -translate-y-[27%] translate-x-[28%] w-[360px] h-[360px] rounded-full bg-gradient-to-br from-sky-400/30 via-indigo-500/20 to-transparent blur-3xl pointer-events-none"/>
            <div className="relative z-10 p-7 sm:p-10 flex h-full flex-col justify-between">
              <div className="flex items-start justify-between gap-4"><div><p className="card-kicker">Trenutačno vrijeme · Mjerna postaja</p><h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mt-2">{requestedPlace ?? station.name}</h2><p className="muted mt-2 text-sm flex items-center gap-2"><MapPin size={14}/>{requestedPlace ? `Podaci s postaje: ${station.name}` : (station.region || 'Hrvatska')}{distance !== null ? ` · ${formatNumber(distance,1)} km zračne udaljenosti` : ''}</p></div><div className="rounded-full py-2 px-3 border border-emerald-400/20 bg-emerald-400/10 text-xs text-emerald-400 flex items-center gap-2 whitespace-nowrap"><span className="cloud-dot"/> DHMZ</div></div>
              <div className="flex flex-wrap gap-5 items-end justify-between mt-7"><div><p className="font-light tracking-[-.085em] text-[105px] sm:text-[132px] leading-[.91] tabular-nums">{formatNumber(station.temperature_c, 1)}<span className="align-top text-5xl font-normal tracking-normal ml-1">°</span></p><p className="capitalize mt-4 text-lg font-medium">{station.conditions || 'Opis vremena nije dostupan'}</p></div><div className="mr-4 mb-3"><WeatherIcon condition={station.conditions} size={120}/></div></div>
              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-8 pt-4 border-t border-white/15 text-xs muted"><span className="inline-flex gap-2 items-center"><Clock3 size={14}/> Vrijeme mjerenja: {dateLabel(station.observed_at)}</span><span className="inline-flex gap-2 items-center"><RefreshCw size={14} className={refreshing?'animate-spin':''}/> Posljednja provjera: {dateLabel(snapshot?.fetched_at ?? null)}</span>{snapshot?.stale && <span className="text-amber-400 font-bold">Prikazuju se posljednji dostupni podaci</span>}</div>
            </div>
          </motion.section>
          <section aria-label="Meteorološke postaje" className="grid grid-rows-[auto_1fr] gap-5">
            <Card className="p-6 sm:p-7"><div className="flex justify-between items-start gap-2"><div><p className="card-kicker">Mreža mjerenja</p><h3 className="text-2xl tracking-tight font-semibold mt-2">{stations.length} <span className="muted font-normal text-base">postaja</span></h3></div><div className="rounded-2xl bg-sky-400/10 p-3 text-sky-400"><Activity size={24}/></div></div><div className="mt-5 pt-4 border-t border-white/10 flex justify-between text-xs muted"><span>{activeCount} postaja s poznatim koordinatama</span><span>Podaci se osvježavaju svakih 60 s</span></div></Card>
            <Card className="p-6 sm:p-7"><div className="flex items-center justify-between mb-4"><div><p className="card-kicker mb-2">Brzi odabir</p><h3 className="font-semibold text-lg">Popularne postaje</h3></div><MapPinned size={20} className="text-sky-400"/></div><div className="grid grid-cols-2 gap-2.5">{featured.length ? featured.map(item=><button key={item.name} onClick={()=>selectStation(item)} aria-pressed={station.name===item.name} className={`text-left rounded-xl py-3 px-3.5 transition-all border ${station.name===item.name?'border-sky-400/45 bg-sky-400/15':'border-white/10 bg-white/5 hover:bg-white/10'}`}><span className="text-[12px] font-semibold truncate block">{item.name}</span><span className="text-xl font-semibold tabular-nums">{formatNumber(item.temperature_c, 1)}°</span></button>) : <span className="col-span-2 muted text-sm">Učitavanje postaja…</span>}</div></Card>
          </section>
        </main>

        <section className="mt-6" aria-labelledby="metrics-title"><div className="flex justify-between gap-3 items-center mb-4"><h2 id="metrics-title" className="font-semibold text-xl tracking-tight">Izmjerene vrijednosti</h2><span className="muted text-xs hidden sm:inline">Podaci izmjereni na postaji {station.name}</span></div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">{metrics.map((m, i)=><motion.div key={m.name} initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{delay:i*.05}}><Card className="min-h-[163px] h-full p-4 sm:p-5 transition-transform hover:-translate-y-1"><div className="flex justify-between gap-2 items-center"><span className="muted text-[11px] sm:text-xs font-medium">{m.name}</span><m.icon size={19} className={m.tone}/></div><div className={`mt-7 tracking-[-.035em] font-semibold tabular-nums ${i===4 ? 'text-sm sm:text-base leading-snug break-words' : 'text-[28px] sm:text-3xl'}`}>{m.value}<span className="text-sm font-normal tracking-normal muted ml-1">{m.unit}</span></div><p className="muted text-[10px] mt-2">{m.hint}</p></Card></motion.div>)}</div>
        </section>

        <section className="mt-7 grid grid-cols-1 lg:grid-cols-[1.35fr_.65fr] gap-5" aria-labelledby="map-heading">
          <div id="map-heading"><CroatiaMap stations={stations} selected={station.name} onSelect={selectStation} onCoordinate={(lat,lon,label)=>void locate(lat,lon,label)}/></div>
          <Card className="p-7 sm:p-8 flex flex-col"><div className="rounded-2xl w-12 h-12 bg-sky-400/10 text-sky-400 flex items-center justify-center mb-7"><Layers3 size={23}/></div><p className="card-kicker">Odabir najbliže postaje</p><h2 className="text-2xl sm:text-3xl font-semibold leading-tight tracking-tight mt-3">Za vaše mjesto.<br/><span className="text-sky-400">Podaci s najbliže postaje.</span></h2><p className="muted text-sm leading-relaxed mt-5">U Hrvatskoj ima više naselja nego meteoroloških postaja. Za odabrano mjesto prikazujemo mjerenja s najbliže dostupne postaje.</p><div className="mt-auto pt-9"><div className="flex items-center gap-3 p-4 rounded-2xl border border-sky-400/15 bg-sky-400/5"><Compass className="text-sky-400" size={25}/><div><div className="text-sm font-semibold">Izračun udaljenosti</div><div className="muted text-xs mt-1">Udaljenost je zračna; podaci su izmjereni na postaji, ne na odabranoj lokaciji.</div></div></div><div className="flex justify-between text-xs muted mt-5"><span>GeoNames · hrvatska naselja</span><span>geoBoundaries · 21 županija</span></div></div></Card>
        </section>

        <section className="mt-8" aria-labelledby="trends-heading"><div className="flex flex-wrap justify-between items-end mb-4 gap-3"><div><p className="card-kicker mb-2">Vremenski niz</p><h2 id="trends-heading" className="text-2xl tracking-tight font-semibold">Kretanje izmjerenih vrijednosti</h2></div><span className="muted text-xs">Arhiva se puni dok je aplikacija pokrenuta. Prognoza nije dostupna.</span></div><WeatherCharts history={history}/></section>
      </>}
      <footer className="mt-16 pt-7 border-t border-white/10 flex flex-wrap justify-between gap-6 items-start"><div className="flex gap-3 items-center"><span className="rounded-xl bg-sky-400/10 text-sky-400 p-2"><CloudSun size={18}/></span><div><p className="font-bold tracking-tight text-sm">CroWeather Pro</p><p className="muted text-xs mt-1">Pokreće WSL Containers · Windows bez Docker Desktopa</p></div></div><div className="muted text-xs leading-relaxed max-w-xl">Izvor podataka o vremenu: <a href="https://meteo.hr" target="_blank" rel="noreferrer" className="underline hover:text-sky-400">DHMZ</a>. Podaci o naseljima: <a className="underline hover:text-sky-400" href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a> (CC BY 4.0), granice županija: <a className="underline hover:text-sky-400" href="https://www.geoboundaries.org/" target="_blank" rel="noreferrer">geoBoundaries</a> (gbOpen CC BY 4.0). Prikazana mjerenja zabilježena su na meteorološkim postajama, ne na adresi korisnika.</div></footer>
    </div>
  </div>;
}
