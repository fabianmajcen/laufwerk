// "Home segment" — port of generate_plots.py find_segment_cluster() +
// compute_segment_stats(): find the largest group of runs sharing a route,
// take the shared opening stretch from the start line, and time every run
// over that exact stretch. The cleanest apples-to-apples fitness test.
//
// Difference vs python: the app's polylines carry no timestamps (decimated
// separately from the time series), so the segment is detected spatially on
// polylines and its length is then mapped onto each run's cumulative-distance
// series to read time/HR/pace. Validated against the python outputs.
import type { ActivitySeries } from "../garmin/types";
import { mean } from "./series";

export interface SegmentRoute {
  activityId: number;
  pts: [number, number][]; // [lat, lon]
}

export interface SegmentStat {
  activityId: number;
  durS: number;
  avgHr: number | null;
  paceMinKm: number | null;
  /** index into the run's polyline where the segment ends (for drawing) */
  endIdx: number;
}

export interface HomeSegment {
  refId: number;
  refEndIdx: number;
  segLenM: number;
  clusterIds: number[];
  stats: SegmentStat[];
}

const MATCH_DIST_M = 25;
const OVERLAP_FRAC = 0.55;
const MIN_LEN_M = 250;

function distToSetM(lat0: number, lon0: number, pts: [number, number][]): Float64Array {
  const mPerLon = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const out = new Float64Array(pts.length);
  for (let i = 0; i < pts.length; i++) {
    const dx = (pts[i][1] - lon0) * mPerLon;
    const dy = (pts[i][0] - lat0) * 110540;
    out[i] = Math.sqrt(dx * dx + dy * dy);
  }
  return out;
}

function minDistM(lat0: number, lon0: number, pts: [number, number][]): number {
  const mPerLon = 111320 * Math.cos((lat0 * Math.PI) / 180);
  let best = Infinity;
  for (const [lat, lon] of pts) {
    const dx = (lon - lon0) * mPerLon;
    const dy = (lat - lat0) * 110540;
    const d = dx * dx + dy * dy;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

export function cumDistM(pts: [number, number][]): number[] {
  if (!pts.length) return [];
  const mPerLon = 111320 * Math.cos((pts[0][0] * Math.PI) / 180);
  const out = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = (pts[i][1] - pts[i - 1][1]) * mPerLon;
    const dy = (pts[i][0] - pts[i - 1][0]) * 110540;
    out.push(out[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  return out;
}

/** Largest group (≥3) of runs whose tracks substantially overlap. */
export function findSegmentCluster(routes: SegmentRoute[]): SegmentRoute[] | null {
  const candidates = routes.filter((r) => r.pts.length >= 10);
  if (candidates.length < 3) return null;

  let best: SegmentRoute[] = [];
  for (const ref of candidates) {
    const cluster = [ref];
    for (const other of candidates) {
      if (other === ref) continue;
      let near = 0;
      let total = 0;
      for (let i = 0; i < ref.pts.length; i += 4) {
        total++;
        if (minDistM(ref.pts[i][0], ref.pts[i][1], other.pts) < MATCH_DIST_M) near++;
      }
      if (total > 0 && near / total >= OVERLAP_FRAC) cluster.push(other);
    }
    if (cluster.length > best.length) best = cluster;
  }
  return best.length >= 3 ? best : null;
}

/** Shared opening stretch + per-run stats over it. */
export function computeSegmentStats(
  cluster: SegmentRoute[],
  seriesById: Map<number, ActivitySeries | null>,
): HomeSegment | null {
  const ref = cluster.reduce((a, b) => (b.pts.length > a.pts.length ? b : a));
  const others = cluster.filter((r) => r !== ref);

  // matched[i]: ref point i is within MATCH_DIST of EVERY other run's track
  const matched = ref.pts.map((p) => others.every((o) => minDistM(p[0], p[1], o.pts) < MATCH_DIST_M));

  let segEndIdx = 0;
  for (let i = 0; i < matched.length; i++) {
    if (!matched[i]) break;
    segEndIdx = i;
  }
  if (segEndIdx < 5) return null;

  const refCum = cumDistM(ref.pts);
  const segLenM = refCum[segEndIdx];
  if (segLenM < MIN_LEN_M) return null;

  const pEnd = ref.pts[segEndIdx];
  const stats: SegmentStat[] = [];

  for (const r of cluster) {
    // nearest point to the segment end within the first half of the run
    const searchN = Math.max(10, Math.floor(0.5 * r.pts.length));
    const dists = distToSetM(pEnd[0], pEnd[1], r.pts.slice(0, searchN));
    let endIdx = 0;
    for (let i = 1; i < dists.length; i++) if (dists[i] < dists[endIdx]) endIdx = i;

    // map the spatial end onto the time series via cumulative distance
    const ownCum = cumDistM(r.pts);
    const segLenForRun = ownCum[endIdx];
    const series = seriesById.get(r.activityId);
    if (!series?.t?.length || !series.dist?.length) continue;

    let j = series.dist.findIndex((d) => d != null && d >= segLenForRun);
    if (j < 0) j = series.dist.length - 1;
    if (j < 2) continue;

    const t0 = series.t[0];
    const tj = series.t[j];
    if (t0 == null || tj == null) continue;

    const hrSlice = (series.hr ?? []).slice(0, j + 1).filter((h): h is number => h != null && h > 0);
    const spSlice = (series.speed ?? []).slice(0, j + 1).filter((s): s is number => s != null && s > 0.3);
    const spMean = mean(spSlice);

    stats.push({
      activityId: r.activityId,
      durS: (tj - t0) / 1000,
      avgHr: mean(hrSlice),
      paceMinKm: spMean != null && spMean > 0 ? 1000 / (spMean * 60) : null,
      endIdx,
    });
  }

  if (stats.length < 3) return null;
  return { refId: ref.activityId, refEndIdx: segEndIdx, segLenM, clusterIds: cluster.map((c) => c.activityId), stats };
}
