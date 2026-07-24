/** 6.2166 min/km -> "6:13" */
export function fmtPace(minPerKm: number | null | undefined): string {
  if (minPerKm == null || !isFinite(minPerKm) || minPerKm <= 0) return "–";
  const totalSec = Math.round(minPerKm * 60);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** seconds -> "37:30" or "1:02:15" */
export function fmtDuration(sec: number | null | undefined): string {
  if (sec == null || !isFinite(sec)) return "–";
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
    : `${m}:${String(ss).padStart(2, "0")}`;
}

/** minutes -> "7h 42m" (sleep durations) */
export function fmtHoursMin(minutes: number | null | undefined): string {
  if (minutes == null || !isFinite(minutes)) return "–";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export function fmtKm(meters: number | null | undefined, digits = 2): string {
  if (meters == null || !isFinite(meters)) return "–";
  return (meters / 1000).toFixed(digits);
}

/** "2026-07-12 20:49:49" -> local Date */
export function parseGarminLocal(s: string): Date {
  return new Date(s.replace(" ", "T"));
}

/** Date -> "Sa 12 Jul" */
export function fmtDay(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** Garmin's "...TimestampLocal" epochs store the wall clock AS IF it were
 *  UTC. To turn them into wall-clock offsets, anchor against UTC midnight of
 *  the calendar date — never against real local midnight. */
export function utcMidnight(isoDay: string): number {
  const [y, m, d] = isoDay.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Date -> "YYYY-MM-DD" (local) */
export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** m/s -> min/km (null when not moving) */
export function speedToPace(mps: number | null | undefined): number | null {
  if (mps == null || mps <= 0.5) return null;
  return Math.min(1000 / (mps * 60), 12);
}
