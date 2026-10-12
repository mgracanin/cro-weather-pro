import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export function formatNumber(value: number | null, digits = 0): string {
  return value === null ? "—" : new Intl.NumberFormat("hr-HR", { maximumFractionDigits: digits }).format(value);
}
export function dateLabel(input: string | null): string {
  if (!input) return "Nije dostupno";
  return new Intl.DateTimeFormat("hr-HR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zagreb" }).format(new Date(input));
}
