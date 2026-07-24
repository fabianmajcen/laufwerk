// Validates the TS segment port against python (decimated polylines + series
// distance-mapping vs full-resolution GPS — tolerances account for that).
// Run: npx tsx scripts/validate-segments.ts
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { findSegmentCluster, computeSegmentStats } from "../src/lib/derive/segments";
import type { ActivityData } from "../src/lib/garmin/types";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(here, "..", "public", "fixtures", "activityData");
const expected = JSON.parse(readFileSync(join(here, "expected-segments.json"), "utf-8"));

const datas: ActivityData[] = readdirSync(FIXTURES).map((f) =>
  JSON.parse(readFileSync(join(FIXTURES, f), "utf-8")),
);

const routes = datas
  .filter((d) => d.polyline && d.polyline.length >= 10)
  .map((d) => ({ activityId: d.activityId, pts: d.polyline! }));
const seriesById = new Map(datas.map((d) => [d.activityId, d.series]));

const cluster = findSegmentCluster(routes);
if (!cluster) {
  console.log("FAIL: no cluster found (python found one of size", expected.clusterSize, ")");
  process.exit(1);
}
console.log(`cluster size: ts=${cluster.length} py=${expected.clusterSize}`);

const seg = computeSegmentStats(cluster, seriesById);
if (!seg) {
  console.log("FAIL: no segment computed");
  process.exit(1);
}
console.log(`segment length: ts=${seg.segLenM.toFixed(0)}m py=${expected.segLenM.toFixed(0)}m (Δ ${(Math.abs(seg.segLenM - expected.segLenM) / expected.segLenM * 100).toFixed(1)}%)`);

let failures = 0;
for (const exp of expected.stats) {
  const got = seg.stats.find((s) => s.activityId === exp.activityId);
  if (!got) {
    console.log(`MISS ${exp.activityId}: not in ts stats`);
    failures++;
    continue;
  }
  const durOk = Math.abs(got.durS - exp.durS) <= Math.max(10, exp.durS * 0.06);
  const hrOk =
    exp.avgHr == null || got.avgHr == null || Math.abs(got.avgHr - exp.avgHr) <= 3;
  if (!durOk || !hrOk) failures++;
  console.log(
    `${durOk && hrOk ? "PASS" : "FAIL"} ${exp.activityId}: dur ts=${got.durS.toFixed(0)}s py=${exp.durS.toFixed(0)}s · hr ts=${got.avgHr?.toFixed(1) ?? "–"} py=${exp.avgHr?.toFixed(1) ?? "–"}`,
  );
}
console.log(failures === 0 ? "\nALL SEGMENT CHECKS PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
