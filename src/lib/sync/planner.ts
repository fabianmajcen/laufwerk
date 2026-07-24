// Pure sync planning: derive the work list from DB state + settings. The
// planner is recomputed from scratch on every sync run, which makes resuming
// after an abort/kill free — finished days are final in Dexie and simply
// don't reappear in the plan.
import { db } from "../db/schema";
import { isoDate } from "../format";
import type { RangeMetric, WellnessMetric } from "../garmin/types";

export interface PlanSettings {
  backfillDays: number;
  readinessBackfillDays: number;
}

export type WorkItem =
  | { kind: "activities"; label: string }
  | { kind: "perDay"; metric: WellnessMetric; date: string; label: string }
  | { kind: "range"; metric: RangeMetric; from: string; to: string; label: string }
  | { kind: "singleton"; metric: "personalRecords"; label: string };

/** a (metric,date) row is final once fetched ≥ 6h after that day ended */
export function isFinal(date: string, fetchedAt: number): boolean {
  const dayEnd = new Date(date + "T00:00:00").getTime() + 30 * 3600 * 1000; // +1d +6h
  return fetchedAt >= dayEnd;
}

const PER_DAY: { metric: WellnessMetric; days: (s: PlanSettings) => number }[] = [
  { metric: "sleep", days: (s) => s.backfillDays },
  { metric: "stress", days: (s) => s.backfillDays },
  { metric: "hrv", days: (s) => s.backfillDays },
  { metric: "readiness", days: (s) => s.readinessBackfillDays },
  { metric: "trainingStatus", days: (s) => s.readinessBackfillDays },
];

// range metrics and their per-request chunk limits (days); steps is a hard
// 28-day API limit, the others are conservative politeness chunks
const RANGES: { metric: RangeMetric; chunk: number }[] = [
  { metric: "bodyBattery", chunk: 31 },
  { metric: "steps", chunk: 28 },
  { metric: "rhr", chunk: 90 },
  { metric: "maxmet", chunk: 90 },
  { metric: "racePredictions", chunk: 180 },
  { metric: "enduranceScore", chunk: 90 },
];

function datesBack(days: number, today: Date): string[] {
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    out.push(isoDate(new Date(today.getTime() - i * 86400000)));
  }
  return out; // newest first
}

export async function plan(settings: PlanSettings, today = new Date()): Promise<WorkItem[]> {
  const items: WorkItem[] = [
    { kind: "activities", label: "activities list" },
    { kind: "singleton", metric: "personalRecords", label: "personal records" },
  ];

  // per-day metrics: newest → oldest, skipping final rows
  for (const { metric, days } of PER_DAY) {
    const dates = datesBack(days(settings), today);
    const existing = await db.wellness.where("metric").equals(metric).toArray();
    const byDate = new Map(existing.map((r) => [r.date, r]));
    for (const date of dates) {
      const row = byDate.get(date);
      if (row && isFinal(date, row.fetchedAt)) continue;
      items.push({ kind: "perDay", metric, date, label: `${metric} ${date}` });
    }
  }

  // range metrics: one chunked fetch from the oldest non-final date forward
  for (const { metric, chunk } of RANGES) {
    const dates = datesBack(settings.backfillDays, today);
    const existing = await db.ranges.where("metric").equals(metric).toArray();
    const byDate = new Map(existing.map((r) => [r.date, r]));
    const missing = dates.filter((d) => {
      const row = byDate.get(d);
      return !row || !isFinal(d, row.fetchedAt);
    });
    if (!missing.length) continue;
    const oldest = missing[missing.length - 1];
    const newest = missing[0];
    // chunk [oldest..newest] into ≤chunk-day requests
    let from = new Date(oldest + "T00:00:00");
    const end = new Date(newest + "T00:00:00");
    while (from <= end) {
      const to = new Date(Math.min(from.getTime() + (chunk - 1) * 86400000, end.getTime()));
      items.push({
        kind: "range",
        metric,
        from: isoDate(from),
        to: isoDate(to),
        label: `${metric} ${isoDate(from)}→${isoDate(to)}`,
      });
      from = new Date(to.getTime() + 86400000);
    }
  }

  return items;
}
