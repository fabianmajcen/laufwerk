// M2 smoke test: exercises the DI token refresh + every endpoint the app uses,
// from Node (i.e. a non-python client) — validates that Garmin accepts our
// headers/flow before any Android work. Also captures real wellness payloads
// as fixtures for mock-mode UI development.
//
// IMPORTANT: refreshing ROTATES the refresh token. This script writes the
// rotated tokens back to ~/.garmin_tokens/garmin_tokens.json atomically so the
// python exporter keeps working.
//
// Usage: node scripts/smoke-api.mjs [wellnessDays=7]
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(here, "..", "public", "fixtures");
const TOKEN_FILE = join(homedir(), ".garmin_tokens", "garmin_tokens.json");
const WELLNESS_DAYS = Number(process.argv[2] ?? 7);

const HEADERS = {
  "User-Agent": "GCM-Android-5.23",
  "X-Garmin-User-Agent":
    "com.garmin.android.apps.connectmobile/5.23; ; Google/sdk_gphone64_arm64/google; Android/33; Dalvik/2.1.0",
  "X-Garmin-Paired-App-Version": "10861",
  "X-Garmin-Client-Platform": "Android",
  "X-App-Ver": "10861",
  "X-Lang": "en",
  "X-GCExperience": "GC5",
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "application/json",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isoDate = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
};

// ---------- auth ----------
let tokens = JSON.parse(readFileSync(TOKEN_FILE, "utf-8"));

async function refresh() {
  const res = await fetch("https://diauth.garmin.com/di-oauth2-service/oauth/token", {
    method: "POST",
    headers: {
      ...HEADERS,
      Authorization: "Basic " + Buffer.from(`${tokens.di_client_id}:`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: tokens.di_client_id,
      refresh_token: tokens.di_refresh_token,
    }),
  });
  if (!res.ok) {
    console.error(`REFRESH FAILED: HTTP ${res.status}`);
    console.error(await res.text());
    process.exit(1);
  }
  const data = await res.json();
  tokens = {
    di_token: data.access_token,
    di_refresh_token: data.refresh_token ?? tokens.di_refresh_token,
    di_client_id: tokens.di_client_id,
  };
  // atomic write-back so the python exporter keeps working after rotation
  const tmp = TOKEN_FILE + ".tmp";
  writeFileSync(tmp, JSON.stringify(tokens));
  renameSync(tmp, TOKEN_FILE);
  const exp = JSON.parse(Buffer.from(data.access_token.split(".")[1], "base64url").toString());
  console.log(`REFRESH OK — new di_token exp ${new Date(exp.exp * 1000).toISOString()}, rotated=${!!data.refresh_token}`);
}

// ---------- api ----------
const results = [];
async function get(name, path, params, { save = null, quiet = false } = {}) {
  const qs = params ? `?${new URLSearchParams(params)}` : "";
  const res = await fetch(`https://connectapi.garmin.com${path}${qs}`, {
    headers: { ...HEADERS, Authorization: `Bearer ${tokens.di_token}` },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* empty */
  }
  const size = body ? JSON.stringify(body).length : 0;
  results.push({ name, status: res.status, size });
  if (!quiet) console.log(`${String(res.status).padStart(3)} ${name} (${size}b)`);
  if (save && res.ok && body != null) {
    mkdirSync(dirname(save), { recursive: true });
    writeFileSync(save, JSON.stringify(body, null, 1));
  }
  await sleep(300);
  return res.ok ? body : null;
}

// ---------- run ----------
await refresh();

const profile = await get("socialProfile", "/userprofile-service/socialProfile", null, {
  save: join(FIXTURES, "samples", "socialProfile.json"),
});
const dn = profile?.displayName;
if (!dn) {
  console.error("No displayName — aborting");
  process.exit(1);
}
console.log(`displayName: ${dn}`);

const today = isoDate(new Date());
const d7 = daysAgo(7);
const d28 = daysAgo(27);

// activities list + one activity bundle
const acts = await get("activities", "/activitylist-service/activities/search/activities", { start: "0", limit: "10" }, { save: join(FIXTURES, "samples", "activities.json") });
const runId = acts?.find?.((a) => (a?.activityType?.typeKey ?? "").includes("run"))?.activityId;
if (runId) {
  await get("activityDetails", `/activity-service/activity/${runId}/details`, { maxChartSize: "2000", maxPolylineSize: "4000" }, { quiet: false });
  await get("activitySplits", `/activity-service/activity/${runId}/splits`);
  await get("activityWeather", `/activity-service/activity/${runId}/weather`);
  await get("activityHrZones", `/activity-service/activity/${runId}/hrTimeInZones`, null, { save: join(FIXTURES, "samples", "hrZones.json") });
}

// range endpoints
await get("bodyBattery(range)", "/wellness-service/wellness/bodyBattery/reports/daily", { startDate: d7, endDate: today }, { save: join(FIXTURES, "samples", "bodyBattery.json") });
await get("steps(range)", `/usersummary-service/stats/steps/daily/${d28}/${today}`, null, { save: join(FIXTURES, "samples", "steps.json") });
await get("rhr(range)", `/userstats-service/wellness/daily/${dn}`, { fromDate: d28, untilDate: today, metricId: "60" }, { save: join(FIXTURES, "samples", "rhr.json") });
await get("maxmet(range)", `/metrics-service/metrics/maxmet/daily/${d28}/${today}`, null, { save: join(FIXTURES, "samples", "maxmet.json") });
await get("racePredictions(latest)", `/metrics-service/metrics/racepredictions/latest/${dn}`, null, { save: join(FIXTURES, "samples", "racePredictions.json") });
await get("enduranceScore(stats)", "/metrics-service/metrics/endurancescore/stats", { startDate: d28, endDate: today, aggregation: "weekly" }, { save: join(FIXTURES, "samples", "enduranceScore.json") });
await get("userSummary(today)", `/usersummary-service/usersummary/daily/${dn}`, { calendarDate: today }, { save: join(FIXTURES, "samples", "userSummary.json") });

// per-day wellness for the last N days -> wellness.json fixture rows
const wellnessRows = [];
for (let i = 0; i < WELLNESS_DAYS; i++) {
  const date = daysAgo(i);
  const perDay = [
    ["sleep", `/wellness-service/wellness/dailySleepData/${dn}`, { date, nonSleepBufferMinutes: "60" }],
    ["stress", `/wellness-service/wellness/dailyStress/${date}`, null],
    ["hrv", `/hrv-service/hrv/${date}`, null],
    ["readiness", `/metrics-service/metrics/trainingreadiness/${date}`, null],
    ["trainingStatus", `/metrics-service/metrics/trainingstatus/aggregated/${date}`, null],
  ];
  for (const [metric, path, params] of perDay) {
    const payload = await get(`${metric} ${date}`, path, params, { quiet: true });
    if (payload != null) wellnessRows.push({ metric, date, payload, fetchedAt: Date.now() });
  }
  console.log(`day ${date}: done`);
}
writeFileSync(join(FIXTURES, "wellness.json"), JSON.stringify(wellnessRows));

// keep one pretty sample of each per-day metric for shape inspection
for (const metric of ["sleep", "stress", "hrv", "readiness", "trainingStatus"]) {
  const row = wellnessRows.find((r) => r.metric === metric && r.payload);
  if (row) writeFileSync(join(FIXTURES, "samples", `${metric}.json`), JSON.stringify(row.payload, null, 1));
}

// ---------- summary ----------
console.log("\n=== SUMMARY ===");
const bad = results.filter((r) => r.status !== 200);
console.log(`${results.length} requests, ${results.length - bad.length} OK, ${bad.length} non-200`);
for (const b of bad) console.log(`  ${b.status} ${b.name}`);
console.log(`wellness fixture rows: ${wellnessRows.length} -> public/fixtures/wellness.json`);
