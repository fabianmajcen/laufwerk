// Validates the TS formula ports against python-computed expected values.
// Run: npx tsx scripts/validate-derive.ts
//
// Tolerances: decoupling ±0.5 pp (fixtures are stride-decimated to ≤600 pts,
// python uses the full ~1050-pt series); form metrics exact-ish (same lap
// inputs, float64 both sides); weekly ±0.05 km (CSV rounds distance to 2 dp).
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { toRunPoints } from "../src/lib/derive/series";
import { computeDecoupling } from "../src/lib/derive/decoupling";
import { computeFormMetrics, type FormMetrics } from "../src/lib/derive/form";
import { computeWeeklyVolume } from "../src/lib/derive/weekly";
import { parseGarminLocal } from "../src/lib/format";
import type { ActivityData, ActivitySummary } from "../src/lib/garmin/types";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(here, "..", "public", "fixtures");
const expected = JSON.parse(readFileSync(join(here, "expected.json"), "utf-8"));

const activities: ActivitySummary[] = JSON.parse(readFileSync(join(FIXTURES, "activities.json"), "utf-8"));
const dataById = new Map<string, ActivityData>();
for (const f of readdirSync(join(FIXTURES, "activityData"))) {
  const d: ActivityData = JSON.parse(readFileSync(join(FIXTURES, "activityData", f), "utf-8"));
  dataById.set(String(d.activityId), d);
}

let failures = 0;
const check = (name: string, actual: number | null, exp: number | null, tol: number) => {
  const ok =
    (actual == null && exp == null) ||
    (actual != null && exp != null && Math.abs(actual - exp) <= tol);
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${name}: ts=${actual?.toFixed(4) ?? "null"} py=${exp?.toFixed(4) ?? "null"}${
      ok ? "" : ` (tol ${tol})`
    }`,
  );
};

console.log("--- decoupling (±0.5 pp, decimated fixtures) ---");
for (const [aid, exp] of Object.entries(expected.decoupling as Record<string, number | null>)) {
  const data = dataById.get(aid);
  const pts = toRunPoints(data?.series);
  check(`decoupling ${aid}`, computeDecoupling(pts), exp, 0.5);
}

console.log("--- form metrics (±1e-6, identical lap inputs) ---");
for (const [aid, expForm] of Object.entries(expected.form as Record<string, FormMetrics>)) {
  const data = dataById.get(aid);
  const form = data ? computeFormMetrics(data.splits) : null;
  for (const key of ["cadenceSpm", "strideLengthCm", "verticalOscCm", "groundContactMs"] as const) {
    check(`form ${aid} ${key}`, form?.[key] ?? null, expForm[key], 1e-6);
  }
}

console.log("--- weekly volume (±0.05 km, CSV rounding) ---");
const runs = activities
  .filter((a) => (a.activityType?.typeKey ?? "").includes("run"))
  .map((a) => ({ date: parseGarminLocal(a.startTimeLocal), distanceKm: (a.distance ?? 0) / 1000 }));
const weekly = computeWeeklyVolume(runs);
const expWeekly = expected.weekly as { weekStart: string; distanceKm: number; cumulativeKm: number }[];
if (weekly.length !== expWeekly.length) {
  failures++;
  console.log(`FAIL weekly length: ts=${weekly.length} py=${expWeekly.length}`);
} else {
  for (let i = 0; i < weekly.length; i++) {
    const w = weekly[i];
    const e = expWeekly[i];
    if (w.weekStart !== e.weekStart) {
      failures++;
      console.log(`FAIL week ${i} start: ts=${w.weekStart} py=${e.weekStart}`);
      continue;
    }
    check(`week ${w.weekStart} km`, w.distanceKm, e.distanceKm, 0.05);
    check(`week ${w.weekStart} cum`, w.cumulativeKm, e.cumulativeKm, 0.05 * (i + 1));
  }
}

console.log(failures === 0 ? "\nALL CHECKS PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
