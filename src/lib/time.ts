// All salon times are Sri Lanka time (UTC+5:30, no DST). Dates are "YYYY-MM-DD", times are minutes since midnight.
const TZ = "Asia/Colombo";

export function colomboNow(): { date: string; minutes: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date()).map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function addDays(date: string, n: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const weekday = (date: string) => new Date(date + "T00:00:00Z").getUTCDay(); // 0 = Sunday

export function fmtTime(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function fmtDate(date: string): string {
  return new Date(date + "T00:00:00Z").toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

export const fmtPrice = (n: number) => `Rs. ${n.toLocaleString("en-LK")}`;

export type DayHours = { closed: boolean; open: number; close: number };

export function defaultHours(): DayHours[] {
  return Array.from({ length: 7 }, () => ({ closed: false, open: 9 * 60, close: 19 * 60 }));
}

export function parseHours(json: string): DayHours[] {
  try {
    const arr = JSON.parse(json);
    if (Array.isArray(arr) && arr.length === 7) return arr as DayHours[];
  } catch {}
  return defaultHours();
}

/** Minutes from now (Colombo) until the given date + start time. Negative if already started/past. */
export function minutesUntil(date: string, startMin: number): number {
  const now = colomboNow();
  const days = (Date.parse(date + "T00:00:00Z") - Date.parse(now.date + "T00:00:00Z")) / 86_400_000;
  return days * 1440 + startMin - now.minutes;
}

export function bookableDates(hours: DayHours[], maxAdvance: number): { date: string; closed: boolean }[] {
  const today = colomboNow().date;
  return Array.from({ length: maxAdvance + 1 }, (_, i) => {
    const date = addDays(today, i);
    return { date, closed: !!hours[weekday(date)]?.closed };
  });
}
