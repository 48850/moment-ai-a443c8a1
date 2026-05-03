import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeToMinutes(time: string): number {
  if (!time) return -1;
  const t = time.trim().toLowerCase();
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return -1;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (isNaN(h) || isNaN(min)) return -1;
  if (t.includes("pm") && h !== 12) h += 12;
  else if (t.includes("am") && h === 12) h = 0;
  return h * 60 + min;
}

export function minutesToTime(minutes: number): string {
  if (minutes < 0) return "00:00";
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
