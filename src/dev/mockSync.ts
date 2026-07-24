// Mock-mode "sync": seeds Dexie from public/fixtures/ (built by scripts/make-fixtures.mjs
// from the real PC exports). Replaces the sync layer, not the client — the UI reads
// Dexie exactly as in production. Active when VITE_MOCK=1.
import { db } from "../lib/db/schema";
import { upsertActivities, putActivityData, bulkPutWellness } from "../lib/db/repo";
import { explodeRangePayload } from "../lib/sync/ingest";
import type { ActivityData, ActivitySummary } from "../lib/garmin/types";

const SEED_KEY = "fixtureSeedVersion";
const SEED_VERSION = 2;

export async function seedFixturesIfNeeded() {
  const seeded = await db.kv.get(SEED_KEY);
  if (seeded?.value === SEED_VERSION && (await db.activities.count()) > 0) return;

  const activities: ActivitySummary[] = await fetchJson("/fixtures/activities.json");
  await upsertActivities(activities);

  for (const a of activities) {
    try {
      const data: ActivityData = await fetchJson(`/fixtures/activityData/${a.activityId}.json`);
      await putActivityData(data);
    } catch {
      // fixture missing for this activity - fine, summary-only
    }
  }

  // Wellness fixtures appear after M2 captures real payloads; seed if present.
  try {
    const wellness = await fetchJson("/fixtures/wellness.json");
    if (Array.isArray(wellness) && wellness.length) {
      await bulkPutWellness(wellness);
    }
  } catch {
    /* not there yet */
  }

  // Range-endpoint samples (captured by scripts/smoke-api.mjs) exploded into
  // per-day rows exactly as the real sync ingest does.
  for (const metric of ["bodyBattery", "steps", "rhr", "maxmet"] as const) {
    try {
      const payload = await fetchJson(`/fixtures/samples/${metric}.json`);
      await bulkPutWellness(explodeRangePayload(metric, payload));
    } catch {
      /* sample not captured */
    }
  }

  await db.kv.put({ key: SEED_KEY, value: SEED_VERSION });
  console.info(`[mock] seeded ${activities.length} activities from fixtures`);
}

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

export const isMockMode = import.meta.env.VITE_MOCK === "1";
