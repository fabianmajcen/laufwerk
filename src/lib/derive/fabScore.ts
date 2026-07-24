// FabScore — the transparent "should I train today?" score. Every factor is
// visible in the UI (factor ladder) and the formula is documented there too:
//
//   score = 100 · Σ weight_i · f_i   over the AVAILABLE factors,
//   weights renormalized when a factor has no data (shown as n/a).
//
// Verdicts: ≥75 Train · 55–74 Easy only · <55 Rest, then injury-aware
// overrides from training_plan.md are applied (they can only make it stricter).

export interface FabInputs {
  /** Garmin sleep score 0-100 (sleepScores.overall.value) */
  sleepScore: number | null;
  sleepSeconds: number | null;
  /** last night's avg HRV (ms) and personal baseline low bound */
  hrvLastNight: number | null;
  hrvBaselineLow: number | null;
  /** Garmin HRV status string (BALANCED | UNBALANCED | LOW | ...) */
  hrvStatus: string | null;
  /** peak body battery today (≈ value at wake) */
  bodyBattery: number | null;
  daysSinceLastRun: number | null;
  /** acute:chronic ratio (null with too little history) */
  acwr: number | null;
  /** today's resting HR and its trailing 7-day average */
  rhrToday: number | null;
  rhr7dAvg: number | null;
}

export type Verdict = "train" | "easy" | "rest";

export interface FabFactor {
  key: string;
  label: string;
  /** raw human-readable value, e.g. "82" or "94 ms (baseline 84–110)" */
  raw: string;
  /** 0..1, null = no data */
  subscore: number | null;
  weight: number;
}

export interface FabResult {
  score: number | null;
  verdict: Verdict | null;
  factors: FabFactor[];
  /** override explanations that changed/capped the verdict */
  overrides: string[];
  /** one-sentence recommendation composed from the limiting factors */
  sentence: string;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function computeFabScore(inp: FabInputs): FabResult {
  const factors: FabFactor[] = [
    {
      key: "sleep",
      label: "Sleep score",
      raw: inp.sleepScore != null ? String(Math.round(inp.sleepScore)) : "no data",
      subscore: inp.sleepScore != null ? clamp01(inp.sleepScore / 100) : null,
      weight: 0.3,
    },
    {
      key: "hrv",
      label: "HRV vs baseline",
      raw:
        inp.hrvLastNight != null
          ? `${inp.hrvLastNight} ms${inp.hrvBaselineLow != null ? ` (baseline low ${inp.hrvBaselineLow})` : ""}`
          : "no data",
      subscore:
        inp.hrvLastNight != null && inp.hrvBaselineLow != null && inp.hrvBaselineLow > 0
          ? clamp01((inp.hrvLastNight - 0.85 * inp.hrvBaselineLow) / (0.15 * inp.hrvBaselineLow))
          : null,
      weight: 0.25,
    },
    {
      key: "bodyBattery",
      label: "Body battery",
      raw: inp.bodyBattery != null ? String(Math.round(inp.bodyBattery)) : "no data",
      subscore: inp.bodyBattery != null ? clamp01(inp.bodyBattery / 100) : null,
      weight: 0.15,
    },
    {
      key: "freshness",
      label: "Days since last run",
      raw: inp.daysSinceLastRun != null ? `${inp.daysSinceLastRun} d` : "no runs",
      subscore:
        inp.daysSinceLastRun == null ? null : inp.daysSinceLastRun <= 0 ? 0.4 : inp.daysSinceLastRun === 1 ? 0.8 : 1.0,
      weight: 0.15,
    },
    {
      key: "load",
      label: "Training load (ACWR)",
      raw: inp.acwr != null ? inp.acwr.toFixed(2) : "building history",
      subscore: inp.acwr == null ? null : acwrSubscore(inp.acwr),
      weight: 0.15,
    },
  ];

  const available = factors.filter((f) => f.subscore != null);
  const totalWeight = available.reduce((s, f) => s + f.weight, 0);
  const score =
    available.length && totalWeight > 0
      ? Math.round((available.reduce((s, f) => s + f.weight * (f.subscore as number), 0) / totalWeight) * 100)
      : null;

  let verdict: Verdict | null = score == null ? null : score >= 75 ? "train" : score >= 55 ? "easy" : "rest";
  const overrides: string[] = [];

  if (verdict != null) {
    if (inp.acwr != null && inp.acwr > 1.5 && verdict === "train") {
      verdict = "easy";
      overrides.push(`Load ramp is steep (ACWR ${inp.acwr.toFixed(2)} > 1.5), so today is capped at Easy.`);
    }
    if (inp.sleepSeconds != null && inp.sleepSeconds < 5 * 3600 && verdict === "train") {
      verdict = "easy";
      overrides.push("Under 5 h sleep, so today is capped at Easy.");
    }
    if (
      inp.hrvStatus?.toUpperCase() === "LOW" &&
      inp.rhrToday != null &&
      inp.rhr7dAvg != null &&
      inp.rhrToday >= inp.rhr7dAvg + 5
    ) {
      verdict = "rest";
      overrides.push("HRV status LOW and resting HR +5 bpm over your weekly average: possible illness. Rest.");
    }
    if (inp.daysSinceLastRun != null && inp.daysSinceLastRun <= 1 && verdict === "train") {
      verdict = "easy";
      overrides.push("You ran yesterday, and the plan keeps at least one rest day between runs.");
    }
  }

  return { score, verdict, factors, overrides, sentence: composeSentence(verdict, factors, overrides, inp) };
}

function acwrSubscore(acwr: number): number {
  if (acwr < 0.8) return 0.9; // undertrained, safe
  if (acwr <= 1.3) return 1.0; // the tunnel
  if (acwr >= 1.8) return 0.4;
  return 1.0 - ((acwr - 1.3) / 0.5) * 0.6; // linear 1.0 → 0.4
}

function composeSentence(
  verdict: Verdict | null,
  factors: FabFactor[],
  overrides: string[],
  inp: FabInputs,
): string {
  if (verdict == null) return "Not enough data yet. Sync a few nights first.";
  if (overrides.length) return overrides[0];

  const limiting = factors
    .filter((f) => f.subscore != null)
    .sort((a, b) => (a.subscore as number) - (b.subscore as number));

  if (verdict === "train") {
    const gapNudge =
      inp.daysSinceLastRun != null && inp.daysSinceLastRun >= 5
        ? ` It's been ${inp.daysSinceLastRun} days, and an easy run today protects your base.`
        : "";
    return `Everything has recovered. Good day for your Zone-2 run.${gapNudge}`;
  }

  const worst = limiting[0];
  const second = limiting[1];
  const parts = [describeFactor(worst), second && (second.subscore as number) < 0.7 ? describeFactor(second) : null]
    .filter(Boolean)
    .join(" and ");
  return verdict === "easy"
    ? `${cap(parts)}. Keep today easy.`
    : `${cap(parts)}. Take a rest day.`;
}

function describeFactor(f: FabFactor | undefined): string | null {
  if (!f || f.subscore == null) return null;
  switch (f.key) {
    case "sleep":
      return `sleep was ${f.raw}/100`;
    case "hrv":
      return `HRV is below your baseline (${f.raw})`;
    case "bodyBattery":
      return `body battery is at ${f.raw}`;
    case "freshness":
      return "you ran recently";
    case "load":
      return `training load is ramping fast (ACWR ${f.raw})`;
    default:
      return null;
  }
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
