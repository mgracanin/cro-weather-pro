export interface WeatherStation {
  name: string;
  lat: number | null;
  lon: number | null;
  region: string | null;
  observed_at: string | null;
  temperature_c: number | null;
  humidity_pct: number | null;
  pressure_hpa: number | null;
  wind_speed_ms: number | null;
  wind_direction: string | null;
  conditions: string | null;
}
export interface Snapshot {
  fetched_at: string;
  source: string;
  stale: boolean;
  stations: WeatherStation[];
}
export interface HistoryPoint {
  timestamp: string;
  temperature_c: number | null;
  humidity_pct: number | null;
  pressure_hpa: number | null;
  wind_speed_ms: number | null;
}
export interface SearchHit {
  name: string;
  lat: number;
  lon: number;
  region: string | null;
  category: "city" | "settlement" | "municipality" | "county" | "station";
}
export interface ResolvedLocation {
  requested: SearchHit | null;
  nearest_station: WeatherStation;
  distance_km: number;
  attribution: string;
}
export interface Health { backend: string; redis: string; weather_feed: string; last_success: string | null; station_count: number }
