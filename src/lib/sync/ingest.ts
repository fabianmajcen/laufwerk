// Payload → storage-row transforms, shared by the sync engine and mock seeding.
import type {
  ActivityData,
  ActivitySeries,
  ActivityWeather,
  HrTimeInZone,
  LapDTO,
  RangeMetric,
  WellnessRow,
} from "../garmin/types";

const MAX_SERIES_POINTS = 600;
const MAX_POLYLINE_POINTS = 500;

// metricDescriptors key -> series field (mirror of scripts/make-fixtures.mjs)
const METRIC_FIELDS: Record<string, keyof ActivitySeries> = {
  directTimestamp: "t",
  directHeartRate: "hr",
  directSpeed: "speed",
  directElevation: "elev",
  directDoubleCadence: "cadence",
  directRunCadence: "cadence",
  directPower: "power",
  sumDistance: "dist",
};

interface DetailsPayload {
  metricDescriptors?: { key: string; metricsIndex: number }[];
  activityDetailMetrics?: { metrics: (number | null)[] }[];
  geoPolylineDTO?: { polyline?: { lat: number; lon: number }[] };
}

function decimate<T>(arr: T[], maxLen: number): T[] {
  if (arr.length <= maxLen) return arr;
  const stride = arr.length / maxLen;
  const out: T[] = [];
  for (let i = 0; i < maxLen; i++) out.push(arr[Math.floor(i * stride)]);
  return out;
}

export function buildActivityData(
  activityId: number,
  details: DetailsPayload | null,
  splits: { lapDTOs?: LapDTO[] } | null,
  weather: ActivityWeather | null,
  hrZonesPayload: HrTimeInZone[] | null,
): ActivityData {
  let series: ActivitySeries | null = null;
  let polyline: [number, number][] | null = null;

  if (details?.metricDescriptors && details.activityDetailMetrics?.length) {
    const index: Partial<Record<keyof ActivitySeries, number>> = {};
    for (const d of details.metricDescriptors) {
      const field = METRIC_FIELDS[d.key];
      if (field && index[field] === undefined) index[field] = d.metricsIndex;
    }
    if (index.t !== undefined) {
      const rows = decimate(details.activityDetailMetrics, MAX_SERIES_POINTS);
      const s: ActivitySeries = { t: [] };
      for (const [field, mi] of Object.entries(index) as [keyof ActivitySeries, number][]) {
        s[field] = rows.map((r) => {
          const v = r.metrics[mi];
          return v === undefined || v === null ? null : v;
        });
      }
      series = s;
    }
  }

  const pts = details?.geoPolylineDTO?.polyline;
  if (pts?.length) {
    polyline = decimate(pts, MAX_POLYLINE_POINTS).map((p) => [p.lat, p.lon]);
  }

  return {
    activityId,
    series,
    polyline,
    splits: splits?.lapDTOs ?? [],
    weather: weather && !("_error" in weather) ? weather : null,
    hrZones: hrZonesPayload ?? null,
    fetchedAt: Date.now(),
  };
}

/** Explode a range-endpoint response into one WellnessRow per day. */
export function explodeRangePayload(metric: RangeMetric, payload: unknown): WellnessRow[] {
  const now = Date.now();
  const rows: WellnessRow[] = [];
  const push = (date: string | undefined, dayPayload: unknown) => {
    if (typeof date === "string" && date.length === 10) {
      rows.push({ metric, date, payload: dayPayload, fetchedAt: now });
    }
  };

  switch (metric) {
    case "bodyBattery":
      for (const day of asArray(payload)) push((day as { date?: string }).date, day);
      break;
    case "steps":
      for (const day of asArray(payload)) push((day as { calendarDate?: string }).calendarDate, day);
      break;
    case "maxmet":
      for (const day of asArray(payload)) {
        const generic = (day as { generic?: { calendarDate?: string } }).generic;
        push(generic?.calendarDate, day);
      }
      break;
    case "rhr": {
      const metrics = (payload as { allMetrics?: { metricsMap?: Record<string, unknown> } })?.allMetrics
        ?.metricsMap?.["WELLNESS_RESTING_HEART_RATE"];
      for (const item of asArray(metrics)) {
        const it = item as { calendarDate?: string; value?: number };
        push(it.calendarDate, it);
      }
      break;
    }
    case "racePredictions":
      for (const day of asArray(payload)) push((day as { calendarDate?: string }).calendarDate, day);
      break;
    case "enduranceScore": {
      // weekly aggregation: keyed by group start date
      const groups = (payload as { groupMap?: Record<string, unknown> })?.groupMap;
      if (groups) for (const [date, g] of Object.entries(groups)) push(date, g);
      break;
    }
  }
  return rows;
}

function asArray(x: unknown): unknown[] {
  return Array.isArray(x) ? x : [];
}
