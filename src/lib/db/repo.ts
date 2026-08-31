import { db, type ActivityRow } from "./schema";
import type {
  ActivityData,
  ActivitySummary,
  WellnessRow,
  WellnessMetric,
  RangeMetric,
} from "../garmin/types";

export function toActivityRow(a: ActivitySummary): ActivityRow {
  return { ...a, typeKey: a.activityType?.typeKey ?? "unknown" };
}

export async function upsertActivities(list: ActivitySummary[]) {
  await db.activities.bulkPut(list.map(toActivityRow));
}

export async function putActivityData(data: ActivityData) {
  await db.activityData.put(data);
}

// ---------- manual exclusions ----------
// Runs you don't want polluting the numbers (a social walk-run, an interval
// session, a battery-death fragment). Kept in kv keyed by activityId, NOT on
// the activity row: every sync re-upserts rows from Garmin and would wipe a
// flag stored there.

const EXCLUDED_KEY = "excludedRuns";

export async function getExcludedRunIds(): Promise<Set<number>> {
  return new Set((await getKv<number[]>(EXCLUDED_KEY)) ?? []);
}

export async function setRunExcluded(activityId: number, excluded: boolean) {
  const ids = await getExcludedRunIds();
  if (excluded) ids.add(activityId);
  else ids.delete(activityId);
  await setKv(EXCLUDED_KEY, [...ids]);
}

/** Every run, newest first, each tagged with its exclusion state. For the run
 *  list and run detail, which must still show (and un-exclude) them. */
export async function getAllRuns(): Promise<ActivityRow[]> {
  const [all, excluded] = await Promise.all([
    db.activities.orderBy("startTimeLocal").reverse().toArray(),
    getExcludedRunIds(),
  ]);
  return all
    .filter((a) => a.typeKey.toLowerCase().includes("run"))
    .map((a) => (excluded.has(a.activityId) ? { ...a, excluded: true } : a));
}

/** Runs that count, newest first: the analytics view of the world. Manually
 *  excluded runs are dropped here, so every chart, the readiness score and
 *  the widget all agree without each having to remember to filter. */
export async function getRuns(): Promise<ActivityRow[]> {
  return (await getAllRuns()).filter((a) => !a.excluded);
}

export async function getActivityData(activityId: number) {
  return db.activityData.get(activityId);
}

export async function putWellness(row: WellnessRow) {
  const table = isRangeMetric(row.metric) ? db.ranges : db.wellness;
  await table.put(row);
}

export async function bulkPutWellness(rows: WellnessRow[]) {
  const perDay = rows.filter((r) => !isRangeMetric(r.metric));
  const ranged = rows.filter((r) => isRangeMetric(r.metric));
  if (perDay.length) await db.wellness.bulkPut(perDay);
  if (ranged.length) await db.ranges.bulkPut(ranged);
}

export function isRangeMetric(m: WellnessMetric | RangeMetric): m is RangeMetric {
  return ["steps", "bodyBattery", "rhr", "maxmet", "racePredictions", "enduranceScore"].includes(m);
}

/** Rows for one metric in [fromDate, toDate], ascending by date. */
export async function getWellnessRange(
  metric: WellnessMetric | RangeMetric,
  fromDate: string,
  toDate: string,
): Promise<WellnessRow[]> {
  const table = isRangeMetric(metric) ? db.ranges : db.wellness;
  return table
    .where("[metric+date]")
    .between([metric, fromDate], [metric, toDate], true, true)
    .toArray();
}

export async function getWellnessDay(metric: WellnessMetric | RangeMetric, date: string) {
  const table = isRangeMetric(metric) ? db.ranges : db.wellness;
  return table.get([metric, date]);
}

export async function getKv<T>(key: string): Promise<T | undefined> {
  const row = await db.kv.get(key);
  return row?.value as T | undefined;
}

export async function setKv(key: string, value: unknown) {
  await db.kv.put({ key, value });
}

export async function getSyncState<T>(key: string): Promise<T | undefined> {
  const row = await db.syncState.get(key);
  return row?.value as T | undefined;
}

export async function setSyncState(key: string, value: unknown) {
  await db.syncState.put({ key, value });
}

/** Everything, for JSON export/backup. */
export async function exportAll() {
  return {
    exportedAt: new Date().toISOString(),
    activities: await db.activities.toArray(),
    activityData: await db.activityData.toArray(),
    wellness: await db.wellness.toArray(),
    ranges: await db.ranges.toArray(),
    kv: await db.kv.toArray(),
    // user-authored and not re-syncable from Garmin, so this is the only copy
    workoutPlans: await db.workoutPlans.toArray(),
    workoutSessions: await db.workoutSessions.toArray(),
    schedule: await db.schedule.toArray(),
  };
}
