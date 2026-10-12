"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin, Search, LoaderCircle } from "lucide-react";
import type { SearchHit } from "@/lib/types";

export function PlaceSearch({ onSelect }: { onSelect: (hit: SearchHit) => void }) {
  const [value, setValue] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapper = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!value.trim()) { setResults([]); setOpen(false); return; }
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setPending(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value.trim())}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Search failed");
        const data = (await res.json()) as SearchHit[];
        setResults(data); setOpen(true); setActive(-1);
      } catch { if (!controller.signal.aborted) { setResults([]); setOpen(false); } }
      finally { if (!controller.signal.aborted) setPending(false); }
    }, 220);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [value]);
  useEffect(() => {
    function outside(e: MouseEvent) { if (wrapper.current && !wrapper.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);
  function choose(hit: SearchHit) { onSelect(hit); setValue(hit.name); setOpen(false); }
  return <div ref={wrapper} className="relative w-full max-w-md">
    <div className="glass-panel relative rounded-2xl flex h-12 items-center gap-3 px-4">
      {pending ? <LoaderCircle size={18} className="animate-spin text-sky-400"/> : <Search size={18} className="muted"/>}
      <input aria-label="Pretražite hrvatska mjesta i meteorološke postaje" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls="place-results" value={value} onChange={e=>setValue(e.target.value)} onFocus={()=>{if(results.length)setOpen(true);}} onKeyDown={e=>{
        if(e.key === 'ArrowDown') { e.preventDefault(); setOpen(true);setActive(i=>Math.min(results.length-1,i+1)); }
        if(e.key === 'ArrowUp') { e.preventDefault();setActive(i=>Math.max(0,i-1)); }
        if(e.key === 'Escape') setOpen(false);
        if(e.key === 'Enter' && results.length) { e.preventDefault();choose(results[active>=0?active:0]); }
      }} className="w-full bg-transparent outline-none placeholder:text-slate-400/80 text-sm min-w-0" placeholder="Pretražite mjesto, npr. Samobor" autoComplete="off" />
      <kbd className="hidden sm:block text-[10px] muted border border-white/15 rounded px-1.5 py-1">HR</kbd>
    </div>
    {open && <div className="absolute z-50 top-[calc(100%+8px)] left-0 right-0 glass-panel rounded-2xl p-2 shadow-2xl max-h-80 overflow-y-auto" id="place-results" role="listbox">
      {results.length ? results.map((hit, idx)=><button key={`${hit.name}-${hit.lat}-${hit.lon}-${idx}`} role="option" aria-selected={idx===active} className={`w-full text-left flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${idx===active ? 'bg-sky-500/20' : 'hover:bg-sky-500/10'}`} onClick={()=>choose(hit)}>
        <span className="rounded-lg p-2 bg-sky-400/10 text-sky-500"><MapPin size={15}/></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium truncate">{hit.name}</span><span className="block muted text-xs truncate">{hit.region || "Hrvatska"} · {hit.category === 'station' ? 'Meteorološka postaja' : 'Naselje'}</span></span>
      </button>) : <p className="muted text-sm px-3 py-3">Nema rezultata pretraživanja.</p>}
    </div>}
  </div>;
}
