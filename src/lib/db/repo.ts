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

/** Runs only (any typeKey containing "run"), newest first. */
export async function getRuns(): Promise<ActivityRow[]> {
  const all = await db.activities.orderBy("startTimeLocal").reverse().toArray();
  return all.filter((a) => a.typeKey.toLowerCase().includes("run"));
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
  };
}
