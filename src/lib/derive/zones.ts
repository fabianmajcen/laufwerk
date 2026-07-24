// Time-in-zones recomputed from the cached HR series against ONE set of zone
// boundaries (the newest run's = the current definition). Keeps history
// comparable when zone settings change, e.g. after correcting resting HR.
import type { ActivitySeries, HrTimeInZone } from "../garmin/types";

/** Zone lower bounds [z1..z5] from a run's hrTimeInZones payload. */
export function zoneBoundaries(hrZones: HrTimeInZone[] | null | undefined): number[] | null {
  if (!hrZones?.length) return null;
  const bounds = [...hrZones]
    .filter((z) => z.zoneNumber != null && z.zoneLowBoundary != null)
    .sort((a, b) => (a.zoneNumber as number) - (b.zoneNumber as number))
    .map((z) => z.zoneLowBoundary as number);
  return bounds.length === 5 ? bounds : null;
}

const MAX_SAMPLE_GAP_S = 15; // don't let recording pauses inflate a zone

/** Seconds in each of Z1..Z5, accumulated over the HR series. */
export function timeInZones(series: ActivitySeries | null | undefined, bounds: number[]): number[] | null {
  if (!series?.t?.length || !series.hr?.length) return null;
  const secs = [0, 0, 0, 0, 0];
  let total = 0;
  for (let i = 1; i < series.t.length; i++) {
    const t0 = series.t[i - 1];
    const t1 = series.t[i];
    const hr = series.hr[i];
    if (t0 == null || t1 == null || hr == null || hr <= 0) continue;
    const dt = Math.min((t1 - t0) / 1000, MAX_SAMPLE_GAP_S);
    if (dt <= 0) continue;
    let z = 0;
    for (let b = 4; b >= 0; b--) {
      if (hr >= bounds[b]) {
        z = b;
        break;
      }
    }
    secs[z] += dt;
    total += dt;
  }
  return total > 60 ? secs : null;
}
