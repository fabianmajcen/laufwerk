// Dexie-backed data hooks — the only way UI components read data.
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ActivityRow, type WorkoutPlanRow, type WorkoutSessionRow } from "./db/schema";
import { getActivityData, getAllRuns, getRuns, getWellnessRange } from "./db/repo";
import {
  getActiveWorkoutSession,
  getRecentWorkoutSessions,
  getWorkoutPlan,
  getWorkoutPlans,
  getWorkoutSessions,
  nextPlanInRotation,
} from "./db/workouts";
import type { ActivityData, RangeMetric, WellnessMetric, WellnessRow } from "./garmin/types";
import { isoDate, parseGarminLocal } from "./format";
import { toRunPoints } from "./derive/series";
import { computeDecoupling } from "./derive/decoupling";
import { computeAcwr } from "./derive/acwr";
import { computeFabScore, type FabResult } from "./derive/fabScore";

/** Runs that count toward stats (manually excluded ones filtered out). */
export function useRuns(): ActivityRow[] | undefined {
  return useLiveQuery(getRuns, []);
}

/** Every run including excluded ones (each carrying `excluded`), for the run
 *  list and detail screen. */
export function useAllRuns(): ActivityRow[] | undefined {
  return useLiveQuery(getAllRuns, []);
}

// ---------- calisthenics ----------

export function useWorkoutPlans(): WorkoutPlanRow[] | undefined {
  return useLiveQuery(getWorkoutPlans, []);
}

export function useWorkoutPlan(id: string | null): WorkoutPlanRow | undefined {
  return useLiveQuery(async () => (id == null ? undefined : getWorkoutPlan(id)), [id]);
}

/** undefined = loading, null = no session in progress. The extra null matters:
 *  "nothing running" is a real answer, not a loading state. */
export function useActiveWorkoutSession(): WorkoutSessionRow | null | undefined {
  return useLiveQuery(async () => (await getActiveWorkoutSession()) ?? null, []);
}

export function useRecentWorkoutSessions(limit?: number): WorkoutSessionRow[] | undefined {
  return useLiveQuery(async () => getRecentWorkoutSessions(limit), [limit]);
}

export function useNextPlanInRotation(): WorkoutPlanRow | undefined {
  return useLiveQuery(nextPlanInRotation, []);
}

/** Counted sessions over the last `days`, oldest first. */
export function useWorkoutSessions(days: number): WorkoutSessionRow[] | undefined {
  return useLiveQuery(async () => {
    const to = isoDate(new Date());
    const from = isoDate(new Date(Date.now() - days * 86400000));
    return getWorkoutSessions(from, to);
  }, [days]);
}

export function useActivityData(activityId: number | null): ActivityData | undefined {
  return useLiveQuery(async () => (activityId == null ? undefined : getActivityData(activityId)), [activityId]);
}

export function useWellnessRange(
  metric: WellnessMetric | RangeMetric,
  days: number,
): WellnessRow[] | undefined {
  return useLiveQuery(async () => {
    const to = isoDate(new Date());
    const from = isoDate(new Date(Date.now() - days * 86400000));
    return getWellnessRange(metric, from, to);
  }, [metric, days]);
}

export function useLatestWellness(metric: WellnessMetric | RangeMetric): WellnessRow | undefined {
  return useLiveQuery(async () => {
    const rows = await getWellnessRange(metric, "0000-00-00", "9999-99-99");
    // sync writes payload:null placeholders for empty days — skip those
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].payload != null) return rows[i];
    }
    return undefined;
  }, [metric]);
}

// ---------- payload views ----------

export interface SleepView {
  date: string;
  score: number | null;
  qualifier: string | null;
  sleepSeconds: number | null;
  deepS: number;
  lightS: number;
  remS: number;
  awakeS: number;
  startLocal: number | null;
  endLocal: number | null;
  restingHeartRate: number | null;
  avgOvernightHrv: number | null;
  hrvStatus: string | null;
  bodyBatteryChange: number | null;
  /** personal sleep need in minutes (Garmin-adjusted) */
  sleepNeedMin: number | null;
  restlessMoments: number | null;
  awakeCount: number | null;
  levels: { startGMT: string; endGMT: string; activityLevel: number }[];
  heartRate: [number, number][]; // [ms epoch, bpm]
  respiration: [number, number][]; // [ms epoch, breaths/min]
}

interface SleepPayload {
  dailySleepDTO?: {
    calendarDate?: string;
    sleepTimeSeconds?: number;
    deepSleepSeconds?: number;
    lightSleepSeconds?: number;
    remSleepSeconds?: number;
    awakeSleepSeconds?: number;
    sleepStartTimestampLocal?: number;
    sleepEndTimestampLocal?: number;
    awakeCount?: number;
    sleepNeed?: { actual?: number; baseline?: number };
    sleepScores?: { overall?: { value?: number; qualifierKey?: string } };
  };
  sleepLevels?: { startGMT: string; endGMT: string; activityLevel: number }[];
  sleepHeartRate?: { startGMT: number; value: number }[];
  wellnessEpochRespirationDataDTOList?: { startTimeGMT: number; respirationValue: number }[];
  restlessMomentsCount?: number;
  restingHeartRate?: number;
  avgOvernightHrv?: number;
  hrvStatus?: string;
  bodyBatteryChange?: number;
}

export function toSleepView(row: WellnessRow | undefined): SleepView | null {
  if (!row) return null;
  const p = row.payload as SleepPayload;
  const dto = p?.dailySleepDTO;
  if (!dto) return null;
  return {
    date: row.date,
    score: dto.sleepScores?.overall?.value ?? null,
    qualifier: dto.sleepScores?.overall?.qualifierKey ?? null,
    sleepSeconds: dto.sleepTimeSeconds ?? null,
    deepS: dto.deepSleepSeconds ?? 0,
    lightS: dto.lightSleepSeconds ?? 0,
    remS: dto.remSleepSeconds ?? 0,
    awakeS: dto.awakeSleepSeconds ?? 0,
    startLocal: dto.sleepStartTimestampLocal ?? null,
    endLocal: dto.sleepEndTimestampLocal ?? null,
    restingHeartRate: p.restingHeartRate ?? null,
    avgOvernightHrv: p.avgOvernightHrv ?? null,
    hrvStatus: p.hrvStatus ?? null,
    bodyBatteryChange: p.bodyBatteryChange ?? null,
    sleepNeedMin: dto.sleepNeed?.actual ?? dto.sleepNeed?.baseline ?? null,
    restlessMoments: p.restlessMomentsCount ?? null,
    awakeCount: dto.awakeCount ?? null,
    levels: p.sleepLevels ?? [],
    heartRate: (p.sleepHeartRate ?? []).map((h) => [h.startGMT, h.value]),
    respiration: (p.wellnessEpochRespirationDataDTOList ?? [])
      .filter((r) => r.respirationValue > 0)
      .map((r) => [r.startTimeGMT, r.respirationValue]),
  };
}

export interface HrvView {
  date: string;
  lastNight: number | null;
  weeklyAvg: number | null;
  baselineLow: number | null;
  baselineUpper: number | null;
  status: string | null;
}

export function toHrvView(row: WellnessRow | undefined): HrvView | null {
  if (!row) return null;
  const s = (row.payload as { hrvSummary?: Record<string, unknown> })?.hrvSummary;
  if (!s) return null;
  const baseline = s.baseline as { balancedLow?: number; balancedUpper?: number } | undefined;
  return {
    date: row.date,
    lastNight: (s.lastNightAvg as number) ?? null,
    weeklyAvg: (s.weeklyAvg as number) ?? null,
    baselineLow: baseline?.balancedLow ?? null,
    baselineUpper: baseline?.balancedUpper ?? null,
    status: (s.status as string) ?? null,
  };
}

export interface BodyBatteryView {
  date: string;
  charged: number | null;
  drained: number | null;
  /** [ms epoch, level] */
  values: [number, number][];
  peak: number | null;
  current: number | null;
}

/** Dense intraday battery curve from a stress-day payload (3-min resolution;
 *  the daily-report endpoint only stores a handful of keyframes). */
export function extractBatteryFromStress(row: WellnessRow | undefined): [number, number][] {
  const p = row?.payload as
    | {
        bodyBatteryValueDescriptorsDTOList?: { bodyBatteryValueDescriptorIndex: number; bodyBatteryValueDescriptorKey: string }[];
        bodyBatteryValuesArray?: unknown[][];
      }
    | undefined;
  if (!p?.bodyBatteryValuesArray?.length) return [];
  const idx = (key: string) =>
    p.bodyBatteryValueDescriptorsDTOList?.find((d) => d.bodyBatteryValueDescriptorKey === key)
      ?.bodyBatteryValueDescriptorIndex ?? -1;
  const ti = idx("timestamp");
  const li = idx("bodyBatteryLevel");
  if (ti < 0 || li < 0) return [];
  return p.bodyBatteryValuesArray
    .map((v) => [v[ti], v[li]] as [number, number])
    .filter(([t, l]) => typeof t === "number" && typeof l === "number");
}

export function toBodyBatteryView(row: WellnessRow | undefined): BodyBatteryView | null {
  if (!row) return null;
  const p = row.payload as {
    charged?: number;
    drained?: number;
    bodyBatteryValuesArray?: [number, number][];
  };
  const values = (p.bodyBatteryValuesArray ?? []).filter(
    (v): v is [number, number] => Array.isArray(v) && v.length >= 2 && v[1] != null,
  );
  const levels = values.map((v) => v[1]);
  return {
    date: row.date,
    charged: p.charged ?? null,
    drained: p.drained ?? null,
    values,
    peak: levels.length ? Math.max(...levels) : null,
    current: levels.length ? levels[levels.length - 1] : null,
  };
}

// ---------- composed: FabScore ----------

export function useFabScore(): { fab: FabResult | null; parts: FabScoreParts } {
  const runs = useRuns();
  const sleepRow = useLatestWellness("sleep");
  const hrvRow = useLatestWellness("hrv");
  const bbRow = useLatestWellness("bodyBattery");
  const rhrRows = useWellnessRange("rhr", 8);

  const sleep = toSleepView(sleepRow);
  const hrv = toHrvView(hrvRow);
  const bb = toBodyBatteryView(bbRow);

  if (runs === undefined) return { fab: null, parts: { sleep, hrv, bb, daysSinceLastRun: null } };

  const today = new Date();
  const lastRun = runs.length ? parseGarminLocal(runs[0].startTimeLocal) : null;
  const daysSinceLastRun = lastRun
    ? Math.floor(
        (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
          new Date(lastRun.getFullYear(), lastRun.getMonth(), lastRun.getDate()).getTime()) /
          86400000,
      )
    : null;

  const acwr = computeAcwr(
    runs.map((r) => ({ date: parseGarminLocal(r.startTimeLocal), distanceKm: (r.distance ?? 0) / 1000 })),
    today,
  );

  const rhrValues = (rhrRows ?? [])
    .map((r) => (r.payload as { value?: number })?.value)
    .filter((v): v is number => typeof v === "number");
  const rhrToday = rhrValues.length ? rhrValues[rhrValues.length - 1] : null;
  const rhr7dAvg = rhrValues.length > 1 ? rhrValues.slice(0, -1).reduce((a, b) => a + b, 0) / (rhrValues.length - 1) : null;

  const fab = computeFabScore({
    sleepScore: sleep?.score ?? null,
    sleepSeconds: sleep?.sleepSeconds ?? null,
    hrvLastNight: hrv?.lastNight ?? null,
    hrvBaselineLow: hrv?.baselineLow ?? null,
    hrvStatus: hrv?.status ?? null,
    bodyBattery: bb?.peak ?? null,
    daysSinceLastRun,
    acwr: acwr.ratio,
    rhrToday,
    rhr7dAvg,
  });

  return { fab, parts: { sleep, hrv, bb, daysSinceLastRun } };
}

export interface FabScoreParts {
  sleep: SleepView | null;
  hrv: HrvView | null;
  bb: BodyBatteryView | null;
  daysSinceLastRun: number | null;
}

// ---------- composed: per-run decoupling for R4 ----------

export interface RunWithDecoupling {
  activityId: number;
  date: Date;
  decoupling: number | null;
}

export function useDecouplingSeries(): RunWithDecoupling[] | undefined {
  return useLiveQuery(async () => {
    const runs = await getRuns();
    const out: RunWithDecoupling[] = [];
    for (const r of [...runs].reverse()) {
      const data = await db.activityData.get(r.activityId);
      out.push({
        activityId: r.activityId,
        date: parseGarminLocal(r.startTimeLocal),
        decoupling: computeDecoupling(toRunPoints(data?.series)),
      });
    }
    return out;
  }, []);
}
