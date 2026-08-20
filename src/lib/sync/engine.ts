// Sequential, polite, resumable sync executor. Progress flows into the
// zustand sync store; durable per-item ingest means an abort or app kill
// loses nothing (the planner recomputes what's missing next run).
import { db } from "../db/schema";
import { bulkPutWellness, putActivityData, putWellness, setKv, setSyncState, upsertActivities } from "../db/repo";
import { gcGet, getDisplayName, sleep, RateLimitedError } from "../garmin/client";
import { AuthExpiredError } from "../garmin/auth";
import { ep } from "../garmin/endpoints";
import { buildActivityData, explodeRangePayload, INGEST_VERSION } from "./ingest";
import { plan, type PlanSettings, type WorkItem } from "./planner";
import { useSync } from "../../store/syncStore";
import { useSettings } from "../../store/settingsStore";
import type { ActivitySummary, ActivityWeather, HrTimeInZone, LapDTO } from "../garmin/types";

let abortRequested = false;
let running = false;

export function abortSync() {
  abortRequested = true;
}

export function isSyncRunning() {
  return running;
}

export async function syncNow(): Promise<void> {
  if (running) return;
  running = true;
  abortRequested = false;
  const store = useSync.getState();
  const settings = useSettings.getState();
  const delayMs = settings.politenessDelayMs;

  try {
    store.setPhase("planning");
    const displayName = await getDisplayName();

    const planSettings: PlanSettings = {
      backfillDays: settings.backfillDays,
      readinessBackfillDays: settings.readinessBackfillDays,
    };
    const items: WorkItem[] = await plan(planSettings);
    let total = items.length;
    let done = 0;
    store.setPhase("running");

    const tick = async (label: string) => {
      done++;
      store.progress(done, total, label);
      await sleep(delayMs + Math.random() * 150);
    };

    for (const item of items) {
      if (abortRequested) {
        store.setPhase("idle");
        return;
      }
      try {
        if (item.kind === "activities") {
          const extra = await runActivities(planSettings, displayName, () => abortRequested, async (label) => {
            done++;
            total++;
            store.progress(done, total, label);
            await sleep(delayMs + Math.random() * 150);
          });
          total += extra;
        } else if (item.kind === "singleton") {
          const payload = await gcGet(ep.personalRecords(displayName)).catch(() => null);
          if (payload != null) await setKv("personalRecords", { payload, fetchedAt: Date.now() });
        } else if (item.kind === "perDay") {
          const payload = await fetchPerDay(item.metric, item.date, displayName);
          if (payload != null) {
            await putWellness({ metric: item.metric, date: item.date, payload, fetchedAt: Date.now() });
          } else {
            // 204/empty — record the attempt so final days stop being re-fetched
            await putWellness({ metric: item.metric, date: item.date, payload: null, fetchedAt: Date.now() });
          }
        } else {
          const payload = await fetchRange(item, displayName);
          if (payload != null) {
            const rows = explodeRangePayload(item.metric, payload);
            await bulkPutWellness(rows);
            // mark requested-but-absent days so they don't replan forever
            const returned = new Set(rows.map((r) => r.date));
            const fillers = [];
            for (let d = new Date(item.from + "T00:00:00"); isoDate(d) <= item.to; d.setDate(d.getDate() + 1)) {
              const ds = isoDate(d);
              if (!returned.has(ds)) fillers.push({ metric: item.metric, date: ds, payload: null, fetchedAt: Date.now() });
            }
            if (fillers.length) await bulkPutWellness(fillers);
          }
        }
        await tick(item.label);
      } catch (e) {
        if (e instanceof RateLimitedError) {
          store.setPhase("error", `Garmin rate limit. Try again in ~${Math.ceil(e.retryAfterS / 60)} min; progress is saved.`);
          return;
        }
        if (e instanceof AuthExpiredError) {
          store.setAuth("expired");
          store.setPhase("error", "Garmin login expired. Re-paste tokens in Settings.");
          return;
        }
        console.warn(`sync item failed (${item.label})`, e);
        await tick(item.label + " (failed)");
      }
    }

    await setSyncState("lastSyncAt", Date.now());
    store.setLastSyncAt(Date.now());
    store.setPhase("done");
  } catch (e) {
    useSync.getState().setPhase("error", e instanceof Error ? e.message : String(e));
  } finally {
    running = false;
  }
}

/** Activities list + per-new-run detail bundles. Returns nothing; bundles are
 *  fetched inline (progress via onBundle so totals stay honest). */
async function runActivities(
  settings: PlanSettings,
  _displayName: string,
  aborted: () => boolean,
  onBundle: (label: string) => Promise<void>,
): Promise<number> {
  const list = await gcGet<ActivitySummary[]>(ep.activities(0, Math.max(50, settings.backfillDays)));
  await upsertActivities(list);

  const cutoff = Date.now() - settings.backfillDays * 86400000;
  const runsNeedingData: ActivitySummary[] = [];
  for (const a of list) {
    const typeKey = a.activityType?.typeKey ?? "";
    if (!typeKey.toLowerCase().includes("run")) continue;
    const start = new Date(String(a.startTimeLocal).replace(" ", "T")).getTime();
    if (isNaN(start) || start < cutoff) continue;
    const existing = await db.activityData.get(a.activityId);
    // re-fetch runs stored by an older ingest version: their series were
    // shaped differently (v1 dropped each run's final samples)
    if (!existing || (existing.ingestV ?? 1) < INGEST_VERSION) runsNeedingData.push(a);
  }

  for (const a of runsNeedingData) {
    if (aborted()) break;
    const id = a.activityId;
    const details = await gcGet(ep.activityDetails(id)).catch(() => null);
    const splits = await gcGet<{ lapDTOs?: LapDTO[] }>(ep.activitySplits(id)).catch(() => null);
    const weather = await gcGet<ActivityWeather>(ep.activityWeather(id)).catch(() => null);
    const hrZones = await gcGet<HrTimeInZone[]>(ep.activityHrZones(id)).catch(() => null);
    await putActivityData(
      buildActivityData(id, details as Parameters<typeof buildActivityData>[1], splits, weather, hrZones),
    );
    await onBundle(`run ${a.startTimeLocal ?? id}`);
  }
  return runsNeedingData.length;
}

async function fetchPerDay(metric: string, date: string, displayName: string): Promise<unknown> {
  switch (metric) {
    case "sleep":
      return gcGet(ep.sleep(displayName, date));
    case "stress":
      return gcGet(ep.stress(date));
    case "hrv":
      return gcGet(ep.hrv(date));
    case "readiness":
      return gcGet(ep.trainingReadiness(date));
    case "trainingStatus":
      return gcGet(ep.trainingStatus(date));
    default:
      return null;
  }
}

async function fetchRange(
  item: { metric: string; from: string; to: string },
  displayName: string,
): Promise<unknown> {
  switch (item.metric) {
    case "bodyBattery":
      return gcGet(ep.bodyBattery(item.from, item.to));
    case "steps":
      return gcGet(ep.steps(item.from, item.to));
    case "rhr":
      return gcGet(ep.rhr(displayName, item.from, item.to));
    case "maxmet":
      return gcGet(ep.maxmet(item.from, item.to));
    case "racePredictions":
      return gcGet(ep.racePredictionsDaily(displayName, item.from, item.to)).catch(() => null);
    case "enduranceScore":
      return gcGet(ep.enduranceScoreStats(item.from, item.to)).catch(() => null);
    default:
      return null;
  }
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
