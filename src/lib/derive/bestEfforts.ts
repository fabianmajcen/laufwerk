// Best efforts: the fastest rolling window of a given distance within each
// run, computed from the cached per-second series (t + cumulative dist).
// Same semantics as Garmin/Strava per-run best efforts.
import type { ActivitySeries } from "../garmin/types";

export interface Effort {
  activityId: number;
  durS: number;
}

/** Fastest time to cover `meters` within one run; null if the run is shorter. */
export function bestEffortForDistance(series: ActivitySeries | null | undefined, meters: number): number | null {
  if (!series?.t?.length || !series.dist?.length) return null;

  // clean, monotone samples
  const t: number[] = [];
  const d: number[] = [];
  for (let i = 0; i < series.t.length; i++) {
    const ti = series.t[i];
    const di = series.dist[i];
    if (ti == null || di == null) continue;
    if (d.length && di < d[d.length - 1]) continue;
    t.push(ti);
    d.push(di);
  }
  if (d.length < 2 || d[d.length - 1] - d[0] < meters) return null;

  let best = Infinity;
  let j = 0;
  for (let i = 0; i < d.length; i++) {
    const target = d[i] + meters;
    if (j < i + 1) j = i + 1;
    while (j < d.length && d[j] < target) j++;
    if (j >= d.length) break;
    // interpolate the exact time the window's end distance was reached
    const dPrev = d[j - 1];
    const tPrev = t[j - 1];
    const frac = d[j] === dPrev ? 0 : (target - dPrev) / (d[j] - dPrev);
    const tEnd = tPrev + frac * (t[j] - tPrev);
    const dur = (tEnd - t[i]) / 1000;
    if (dur < best) best = dur;
  }
  return isFinite(best) ? best : null;
}
