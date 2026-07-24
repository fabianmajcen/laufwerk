// Weekly volume, ported from generate_plots.py plot_weekly_volume():
// Monday-start weeks, continuous week range with zero-filled gaps, cumulative.
import { isoDate } from "../format";

export interface WeekVolume {
  /** Monday of the week, YYYY-MM-DD */
  weekStart: string;
  distanceKm: number;
  cumulativeKm: number;
}

/** Monday 00:00 of the week containing d. */
export function weekStartOf(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const mondayIndex = (out.getDay() + 6) % 7; // Mon=0 … Sun=6 (pandas dayofweek)
  out.setDate(out.getDate() - mondayIndex);
  return out;
}

export function computeWeeklyVolume(runs: { date: Date; distanceKm: number }[]): WeekVolume[] {
  if (!runs.length) return [];
  const byWeek = new Map<string, number>();
  let minWeek: Date | null = null;
  let maxWeek: Date | null = null;

  for (const r of runs) {
    const ws = weekStartOf(r.date);
    const key = isoDate(ws);
    byWeek.set(key, (byWeek.get(key) ?? 0) + r.distanceKm);
    if (!minWeek || ws < minWeek) minWeek = ws;
    if (!maxWeek || ws > maxWeek) maxWeek = ws;
  }

  const out: WeekVolume[] = [];
  let cum = 0;
  for (let w = new Date(minWeek!); w <= maxWeek!; w.setDate(w.getDate() + 7)) {
    const km = byWeek.get(isoDate(w)) ?? 0;
    cum += km;
    out.push({ weekStart: isoDate(w), distanceKm: km, cumulativeKm: cum });
  }
  return out;
}
