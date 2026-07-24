// Per-run time-series preparation, ported 1:1 from generate_plots.py
// load_run_details(): keep rows with hr > 0, elapsed minutes from the first
// kept timestamp, pace only while moving (speed > 0.5 m/s), clipped to 12.
import type { ActivitySeries } from "../garmin/types";

export interface RunPoints {
  /** ms epoch */
  t: number[];
  elapsedMin: number[];
  distKm: (number | null)[];
  hr: number[];
  speed: (number | null)[];
  /** min/km, null when not moving; clipped at 12 */
  pace: (number | null)[];
  cadence: (number | null)[];
  elev: (number | null)[];
}

export function toRunPoints(series: ActivitySeries | null | undefined): RunPoints | null {
  if (!series?.t?.length) return null;
  const n = series.t.length;
  const out: RunPoints = { t: [], elapsedMin: [], distKm: [], hr: [], speed: [], pace: [], cadence: [], elev: [] };

  for (let i = 0; i < n; i++) {
    const t = series.t[i];
    const hr = series.hr?.[i] ?? null;
    if (t == null || hr == null || hr <= 0) continue; // python: ts_df[ts_df.hr > 0]
    const speed = series.speed?.[i] ?? null;
    out.t.push(t);
    out.hr.push(hr);
    out.speed.push(speed);
    out.pace.push(speed != null && speed > 0.5 ? Math.min(1000 / (speed * 60), 12) : null);
    out.distKm.push(series.dist?.[i] != null ? (series.dist![i] as number) / 1000 : null);
    out.cadence.push(series.cadence?.[i] ?? null);
    out.elev.push(series.elev?.[i] ?? null);
  }
  if (!out.t.length) return null;
  const t0 = out.t[0];
  out.elapsedMin = out.t.map((t) => (t - t0) / 1000 / 60);

  // Garmin's per-second "directDoubleCadence" arrives per-leg (~85) despite
  // the name, while lap/summary cadence is total steps/min (~170). Double the
  // series when it is implausibly low for running so all cadence displays
  // agree. (The python plots showed the raw per-leg values.)
  const cad = out.cadence.filter((c): c is number => c != null && c > 0).sort((a, b) => a - b);
  if (cad.length && cad[Math.floor(cad.length / 2)] < 120) {
    out.cadence = out.cadence.map((c) => (c != null ? c * 2 : null));
  }
  return out;
}

/** Centered rolling mean, pandas rolling(window, center=True, min_periods=1)
 *  semantics: window w at index i covers [i - floor(w/2), i + floor((w-1)/2)],
 *  nulls skipped. */
export function rollingMean(values: (number | null)[], window: number): (number | null)[] {
  const half = Math.floor(window / 2);
  const rightHalf = Math.floor((window - 1) / 2);
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + rightHalf); j++) {
      const v = values[j];
      if (v != null && Number.isFinite(v)) {
        sum += v;
        count++;
      }
    }
    out[i] = count > 0 ? sum / count : null;
  }
  return out;
}

export function mean(values: (number | null | undefined)[]): number | null {
  let sum = 0;
  let count = 0;
  for (const v of values) {
    if (v != null && Number.isFinite(v)) {
      sum += v;
      count++;
    }
  }
  return count ? sum / count : null;
}

/** Least-squares linear fit; returns [slope, intercept] like np.polyfit(deg=1). */
export function linearFit(x: number[], y: number[]): [number, number] | null {
  if (x.length < 2 || x.length !== y.length) return null;
  const mx = x.reduce((a, b) => a + b, 0) / x.length;
  const my = y.reduce((a, b) => a + b, 0) / y.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < x.length; i++) {
    num += (x[i] - mx) * (y[i] - my);
    den += (x[i] - mx) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den;
  return [slope, my - slope * mx];
}
