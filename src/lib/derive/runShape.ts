// "Run shape" — every run resampled onto a 0–100% elapsed grid, then the
// median profile across runs (port of the average panel in
// generate_plots.py plot_hr_vs_pace_per_run, using median instead of mean
// and adding IQR bands).
import type { RunPoints } from "./series";

export interface RunShape {
  /** 0..100 (%) */
  grid: number[];
  hrMedian: (number | null)[];
  hrLo: (number | null)[]; // 25th percentile
  hrHi: (number | null)[]; // 75th percentile
  paceMedian: (number | null)[];
  paceLo: (number | null)[];
  paceHi: (number | null)[];
  nRuns: number;
}

const GRID_N = 101;

function interpOnGrid(elapsedMin: number[], values: (number | null)[]): (number | null)[] {
  // forward/backward-fill nulls first (python: interpolate + bfill + ffill)
  const filled = [...values];
  let last: number | null = null;
  for (let i = 0; i < filled.length; i++) {
    if (filled[i] == null) filled[i] = last;
    else last = filled[i];
  }
  let next: number | null = null;
  for (let i = filled.length - 1; i >= 0; i--) {
    if (filled[i] == null) filled[i] = next;
    else next = filled[i];
  }

  const total = elapsedMin[elapsedMin.length - 1] - elapsedMin[0];
  if (total <= 0) return new Array(GRID_N).fill(null);
  const out: (number | null)[] = [];
  let j = 0;
  for (let g = 0; g < GRID_N; g++) {
    const target = elapsedMin[0] + (g / (GRID_N - 1)) * total;
    while (j < elapsedMin.length - 2 && elapsedMin[j + 1] < target) j++;
    const x0 = elapsedMin[j];
    const x1 = elapsedMin[j + 1];
    const y0 = filled[j];
    const y1 = filled[j + 1];
    if (y0 == null || y1 == null) {
      out.push(y0 ?? y1 ?? null);
    } else if (x1 === x0) {
      out.push(y0);
    } else {
      out.push(y0 + ((target - x0) / (x1 - x0)) * (y1 - y0));
    }
  }
  return out;
}

function percentile(sorted: number[], p: number): number {
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function computeRunShape(runs: RunPoints[]): RunShape | null {
  const usable = runs.filter((r) => r.elapsedMin.length >= 20);
  if (usable.length < 3) return null;

  const hrCurves = usable.map((r) => interpOnGrid(r.elapsedMin, r.hr));
  const paceCurves = usable.map((r) => interpOnGrid(r.elapsedMin, r.pace));

  const grid = Array.from({ length: GRID_N }, (_, i) => i);
  const agg = (curves: (number | null)[][], g: number, p: number): number | null => {
    const vals = curves.map((c) => c[g]).filter((v): v is number => v != null && isFinite(v));
    if (vals.length < 3) return null;
    return percentile([...vals].sort((a, b) => a - b), p);
  };

  return {
    grid,
    hrMedian: grid.map((g) => agg(hrCurves, g, 0.5)),
    hrLo: grid.map((g) => agg(hrCurves, g, 0.25)),
    hrHi: grid.map((g) => agg(hrCurves, g, 0.75)),
    paceMedian: grid.map((g) => agg(paceCurves, g, 0.5)),
    paceLo: grid.map((g) => agg(paceCurves, g, 0.25)),
    paceHi: grid.map((g) => agg(paceCurves, g, 0.75)),
    nRuns: usable.length,
  };
}
