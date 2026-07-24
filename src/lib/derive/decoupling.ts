// Aerobic decoupling, ported 1:1 from generate_plots.py compute_decoupling():
// drop the first 5 min (warm-up), split the rest at the elapsed-time midpoint,
// efficiency = mean(speed)/mean(HR) over moving samples (speed > 0.5),
// decoupling % = (ef1 - ef2) / ef1 * 100. ≤5% = well-developed aerobic base.
import type { RunPoints } from "./series";
import { mean } from "./series";

export const WARMUP_MIN = 5;
export const DECOUPLING_TARGET_PCT = 5;

export function computeDecoupling(pts: RunPoints | null): number | null {
  if (!pts || !pts.t.length) return null;

  const idx: number[] = [];
  for (let i = 0; i < pts.elapsedMin.length; i++) {
    if (pts.elapsedMin[i] >= WARMUP_MIN) idx.push(i);
  }
  if (!idx.length) return null;

  const eMin = pts.elapsedMin[idx[0]];
  const eMax = pts.elapsedMin[idx[idx.length - 1]];
  const mid = (eMin + eMax) / 2;

  const ef = (part: number[]): number | null => {
    const moving = part.filter((i) => (pts.speed[i] ?? 0) > 0.5);
    if (!moving.length) return null;
    const s = mean(moving.map((i) => pts.speed[i]));
    const h = mean(moving.map((i) => pts.hr[i]));
    return s != null && h != null && h !== 0 ? s / h : null;
  };

  const ef1 = ef(idx.filter((i) => pts.elapsedMin[i] <= mid));
  const ef2 = ef(idx.filter((i) => pts.elapsedMin[i] > mid));
  if (ef1 == null || ef2 == null || ef1 === 0) return null;
  return ((ef1 - ef2) / ef1) * 100;
}
