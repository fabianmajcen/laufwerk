// Running-form metrics per run: distance-weighted lap averages, ported 1:1
// from generate_plots.py plot_running_form_trend() (laps > 200 m only).
import type { LapDTO } from "../garmin/types";

export interface FormMetrics {
  cadenceSpm: number | null;
  strideLengthCm: number | null;
  verticalOscCm: number | null;
  groundContactMs: number | null;
}

export const FORM_DIRECTION: Record<keyof FormMetrics, "higher" | "lower"> = {
  cadenceSpm: "higher",
  strideLengthCm: "higher",
  verticalOscCm: "lower",
  groundContactMs: "lower",
};

export function computeFormMetrics(laps: LapDTO[]): FormMetrics {
  const valid = laps.filter((l) => (l.distance ?? 0) > 200);

  const wavg = (key: keyof LapDTO): number | null => {
    let num = 0;
    let den = 0;
    for (const l of valid) {
      const v = l[key];
      const w = l.distance;
      if (typeof v === "number" && typeof w === "number") {
        num += v * w;
        den += w;
      }
    }
    return den > 0 ? num / den : null;
  };

  return {
    cadenceSpm: wavg("averageRunCadence"),
    strideLengthCm: wavg("strideLength"),
    verticalOscCm: wavg("verticalOscillation"),
    groundContactMs: wavg("groundContactTime"),
  };
}
