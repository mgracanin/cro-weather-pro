import { type NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
const ALLOWED = new Set(["weather", "stations", "station", "location", "search", "history", "health", "metrics"]);

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (!path.length || !ALLOWED.has(path[0]) || path.length > 2 || (path.length === 2 && path[0] !== "station")) {
    return NextResponse.json({ detail: "Unknown API route" }, { status: 404 });
  }
  const base = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";
  const dest = new URL(`${base}/api/${path.map(encodeURIComponent).join("/")}`);
  dest.search = request.nextUrl.search;
  try {
    const response = await fetch(dest, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    const contentType = response.headers.get("content-type") ?? "application/json";
    return new NextResponse(await response.arrayBuffer(), {
      status: response.status, headers: { "content-type": contentType, "cache-control": "no-store", "x-content-type-options": "nosniff" },
    });
  } catch {
    return NextResponse.json({ detail: "Meteorološka usluga trenutačno nije dostupna." }, { status: 503 });
  }
}
export { proxy as GET };
