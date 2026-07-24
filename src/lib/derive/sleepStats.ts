// Advanced sleep analytics, computed from cached wellness rows.
import type { SleepView } from "../hooks";

export interface SleepDebtPoint {
  date: string;
  sleptMin: number;
  needMin: number;
  /** rolling 7-night average of sleep duration */
  avg7Min: number | null;
  /** cumulative (need − slept) over the window, floored at 0 */
  debtMin: number;
}

export function computeSleepDebt(nights: SleepView[]): SleepDebtPoint[] {
  const valid = nights.filter((n) => n.sleepSeconds != null && n.sleepSeconds > 0);
  const out: SleepDebtPoint[] = [];
  let debt = 0;
  for (let i = 0; i < valid.length; i++) {
    const n = valid[i];
    const sleptMin = (n.sleepSeconds as number) / 60;
    const needMin = n.sleepNeedMin ?? 480;
    debt = Math.max(0, debt + (needMin - sleptMin));
    const win = valid.slice(Math.max(0, i - 6), i + 1);
    const avg7 =
      win.length >= 3 ? win.reduce((a, w) => a + (w.sleepSeconds as number) / 60, 0) / win.length : null;
    out.push({ date: n.date, sleptMin, needMin, avg7Min: avg7, debtMin: debt });
  }
  return out;
}

export interface RegularityStats {
  /** std deviation of bedtime in minutes over the window */
  bedtimeSdMin: number;
  wakeSdMin: number;
  /** weekend minus weekday median bedtime (min); positive = later on weekends */
  socialJetlagMin: number | null;
  nights: number;
}

export function computeRegularity(nights: SleepView[]): RegularityStats | null {
  const valid = nights.filter((n) => n.startLocal != null && n.endLocal != null);
  if (valid.length < 5) return null;

  // bedtime as minutes since 18:00 of the previous evening (avoids midnight wrap)
  const bedMin = (n: SleepView) => {
    const dayStart = new Date(n.date + "T00:00:00").getTime();
    const anchor = dayStart - 6 * 3600000; // 18:00 previous day
    return ((n.startLocal as number) - anchor) / 60000;
  };
  const wakeMin = (n: SleepView) => {
    const dayStart = new Date(n.date + "T00:00:00").getTime();
    return ((n.endLocal as number) - dayStart) / 60000;
  };

  const sd = (xs: number[]) => {
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
  };
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };

  const beds = valid.map(bedMin);
  const wakes = valid.map(wakeMin);

  // weekend night = the night leading into Sat/Sun (calendarDate is Sat/Sun)
  const isWeekend = (n: SleepView) => {
    const dow = new Date(n.date + "T00:00:00").getDay();
    return dow === 0 || dow === 6;
  };
  const wkndBeds = valid.filter(isWeekend).map(bedMin);
  const wkdyBeds = valid.filter((n) => !isWeekend(n)).map(bedMin);

  return {
    bedtimeSdMin: sd(beds),
    wakeSdMin: sd(wakes),
    socialJetlagMin: wkndBeds.length >= 2 && wkdyBeds.length >= 3 ? median(wkndBeds) - median(wkdyBeds) : null,
    nights: valid.length,
  };
}

export interface StagePoint {
  date: string;
  deepPct: number;
  remPct: number;
  lightPct: number;
}

/** Adult reference ranges (AASM-ish): deep 13–23%, REM 20–25%. */
export const DEEP_NORM: [number, number] = [13, 23];
export const REM_NORM: [number, number] = [20, 25];

export function computeStageBalance(nights: SleepView[]): StagePoint[] {
  return nights
    .filter((n) => n.deepS + n.lightS + n.remS > 0)
    .map((n) => {
      const total = n.deepS + n.lightS + n.remS + n.awakeS;
      return {
        date: n.date,
        deepPct: (n.deepS / total) * 100,
        remPct: (n.remS / total) * 100,
        lightPct: (n.lightS / total) * 100,
      };
    });
}

export interface GroupComparison {
  metric: string;
  unit: string;
  afterRun: number | null;
  afterRest: number | null;
  nRun: number;
  nRest: number;
}

/** Sleep on nights following run days vs rest days. Honest about sample sizes. */
export function compareRunVsRestSleep(nights: SleepView[], runDates: Set<string>): GroupComparison[] {
  // the night with calendarDate D reflects the evening of D-1 → group by D-1
  const prevDay = (date: string) => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const afterRun = nights.filter((n) => runDates.has(prevDay(n.date)));
  const afterRest = nights.filter((n) => !runDates.has(prevDay(n.date)));

  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x != null && isFinite(x));
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };

  const rows: [string, string, (n: SleepView) => number | null][] = [
    ["Sleep score", "", (n) => n.score],
    ["Deep sleep", "min", (n) => (n.deepS > 0 ? n.deepS / 60 : null)],
    ["Overnight HRV", "ms", (n) => n.avgOvernightHrv],
    ["Resting HR", "bpm", (n) => n.restingHeartRate],
  ];

  return rows.map(([metric, unit, get]) => ({
    metric,
    unit,
    afterRun: avg(afterRun.map(get)),
    afterRest: avg(afterRest.map(get)),
    nRun: afterRun.length,
    nRest: afterRest.length,
  }));
}
