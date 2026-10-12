"use client";
import { motion } from "framer-motion";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import type { HistoryPoint } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { dateLabel } from "@/lib/utils";

const configs = [
  { key: "temperature_c" as const, label: "Temperatura", unit: "°C", stroke: "#fbbf24" },
  { key: "humidity_pct" as const, label: "Vlažnost", unit: "%", stroke: "#38bdf8" },
  { key: "pressure_hpa" as const, label: "Tlak zraka", unit: "hPa", stroke: "#a78bfa" },
  { key: "wind_speed_ms" as const, label: "Vjetar", unit: "m/s", stroke: "#34d399" },
];
export default function WeatherCharts({ history }: { history: HistoryPoint[] }) {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    {configs.map(({key, label, unit, stroke}, i) => {
      const data = history.filter(point => point[key] !== null).map(point => ({ ...point, pretty: new Date(point.timestamp).toLocaleTimeString("hr-HR", { timeZone: "Europe/Zagreb", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) }));
      return <motion.div key={key} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35, delay: i * .06 }}>
        <Card className="p-5 sm:p-6">
          <div className="mb-1 flex justify-between items-center"><h3 className="font-semibold text-[15px]">{label}</h3><span className="muted text-xs">{unit}</span></div>
          <div className="mb-4 muted text-xs">Broj izmjerenih vrijednosti: {data.length}</div>
          {data.length < 2 ? <div className="flex h-[155px] flex-col items-center justify-center text-center muted text-sm px-4"><span>Još nema dovoljno podataka za prikaz trenda.</span><span className="mt-2 text-xs">Graf će se prikazati nakon što se prikupe nova DHMZ-ova mjerenja.</span></div> :
            <div className="h-[170px] w-full" role="img" aria-label={`Graf ${label}: ${data.length} opažanja`}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 4, right: 8, left: -26, bottom: 4 }}>
                  <defs><linearGradient id={`grad-${key}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={stroke} stopOpacity={.3}/><stop offset="95%" stopColor={stroke} stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid stroke="currentColor" opacity={.07} vertical={false}/>
                  <XAxis dataKey="pretty" tick={{fill: "#94a3b8", fontSize: 10}} tickLine={false} axisLine={false} minTickGap={22}/>
                  <YAxis tick={{fill: "#94a3b8", fontSize: 10}} tickLine={false} axisLine={false} domain={["auto", "auto"]}/>
                  <Tooltip contentStyle={{ background: "#12253d", border: "1px solid #36506c", borderRadius: 14, color: "#eef6ff" }} labelFormatter={(_label, payload) => payload?.[0]?.payload?.timestamp ? dateLabel(payload[0].payload.timestamp) : ''} formatter={(value) => [`${value ?? '—'} ${unit}`, label]}/>
                  <Area type="monotone" dataKey={key} stroke={stroke} strokeWidth={2.5} fill={`url(#grad-${key})`} dot={data.length < 15}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>}
        </Card>
      </motion.div>;
    })}
  </div>;
}
