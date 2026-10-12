import { Dashboard } from "@/components/dashboard";
import type { Snapshot } from "@/lib/types";
export const dynamic = "force-dynamic";
export default async function Home() {
  let initial: Snapshot | null = null;
  try {
    const res = await fetch(`${process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000"}/api/weather`, { cache: "no-store", signal: AbortSignal.timeout(12000) });
    if (res.ok) initial = (await res.json()) as Snapshot;
  } catch { /* Client polls and displays a real error state; no synthetic weather. */ }
  return <Dashboard initial={initial} />;
}
