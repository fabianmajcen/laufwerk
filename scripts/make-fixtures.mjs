// Builds dev fixtures from the real PC exports in ../activities/ (created by
// ../garmin_export.py). Output mirrors what the app's sync ingest produces, so
// mock mode exercises the same data shapes as a real sync.
//
// Usage: node scripts/make-fixtures.mjs
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ACTIVITIES_DIR = join(here, "..", "..", "activities");
const OUT_DIR = join(here, "..", "public", "fixtures");

const MAX_SERIES_POINTS = 600;
const MAX_POLYLINE_POINTS = 500;

// metricDescriptors key -> series field. directDoubleCadence is total steps/min
// (both feet), same unit the summary CSV uses.
const METRIC_FIELDS = {
  directTimestamp: "t",
  directHeartRate: "hr",
  directSpeed: "speed",
  directElevation: "elev",
  directDoubleCadence: "cadence",
  directRunCadence: "cadence",
  directPower: "power",
  sumDistance: "dist",
};

function decimate(arr, maxLen) {
  if (arr.length <= maxLen) return arr;
  const stride = arr.length / maxLen;
  const out = [];
  for (let i = 0; i < maxLen; i++) out.push(arr[Math.floor(i * stride)]);
  return out;
}

function buildSeries(details) {
  const descriptors = details.metricDescriptors ?? [];
  const rows = details.activityDetailMetrics ?? [];
  const index = {};
  for (const d of descriptors) {
    const field = METRIC_FIELDS[d.key];
    if (field && !(field in index)) index[field] = d.metricsIndex;
  }
  if (index.t === undefined || rows.length === 0) return null;

  const picked = decimate(rows, MAX_SERIES_POINTS).map((r) => r.metrics);
  const series = {};
  for (const [field, mi] of Object.entries(index)) {
    series[field] = picked.map((m) => {
      const v = m[mi];
      return v === undefined || v === null ? null : v;
    });
  }
  return series;
}

function buildPolyline(details) {
  const pts = details.geoPolylineDTO?.polyline ?? [];
  if (!pts.length) return null;
  return decimate(pts, MAX_POLYLINE_POINTS).map((p) => [p.lat, p.lon]);
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

if (!existsSync(ACTIVITIES_DIR)) {
  console.error(`No activities dir at ${ACTIVITIES_DIR} - run the python export first.`);
  process.exit(1);
}

mkdirSync(join(OUT_DIR, "activityData"), { recursive: true });

const summaries = [];
for (const folder of readdirSync(ACTIVITIES_DIR)) {
  const dir = join(ACTIVITIES_DIR, folder);
  let activity;
  try {
    activity = loadJson(join(dir, "activity.json"));
  } catch {
    continue; // not an activity folder
  }
  summaries.push(activity);

  const details = loadJson(join(dir, "details.json"));
  const splits = loadJson(join(dir, "splits.json"));
  let weather = null;
  try {
    weather = loadJson(join(dir, "weather.json"));
    if (weather._error) weather = null;
  } catch {
    /* optional */
  }

  const data = {
    activityId: activity.activityId,
    series: buildSeries(details),
    polyline: buildPolyline(details),
    splits: splits.lapDTOs ?? [],
    weather,
    hrZones: null, // captured from the real API in M2; not in the PC export
    fetchedAt: Date.now(),
  };
  writeFileSync(join(OUT_DIR, "activityData", `${activity.activityId}.json`), JSON.stringify(data));
  console.log(`activity ${activity.activityId}: ${data.series ? Object.keys(data.series).length : 0} series fields, ${data.polyline?.length ?? 0} polyline pts, ${data.splits.length} laps`);
}

summaries.sort((a, b) => String(a.startTimeLocal).localeCompare(String(b.startTimeLocal)));
writeFileSync(join(OUT_DIR, "activities.json"), JSON.stringify(summaries));
console.log(`wrote ${summaries.length} activity summaries -> public/fixtures/`);
