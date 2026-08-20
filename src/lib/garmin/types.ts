// Loose types for the Garmin payload fields the app actually reads.
// Payloads carry many more fields; we keep them (stored as-is) but only type what we use.

export interface ActivitySummary {
  activityId: number;
  activityName?: string;
  startTimeLocal: string; // "YYYY-MM-DD HH:mm:ss"
  activityType?: { typeKey?: string };
  distance?: number; // m
  duration?: number; // s
  movingDuration?: number; // s
  averageSpeed?: number; // m/s
  averageHR?: number;
  maxHR?: number;
  calories?: number;
  elevationGain?: number;
  elevationLoss?: number;
  averageRunningCadenceInStepsPerMinute?: number;
  maxRunningCadenceInStepsPerMinute?: number;
  avgStrideLength?: number; // cm in summary payloads
  vO2MaxValue?: number;
  aerobicTrainingEffect?: number;
  anaerobicTrainingEffect?: number;
  trainingEffectLabel?: string;
  startLatitude?: number;
  startLongitude?: number;
  [key: string]: unknown;
}

/** Columnar per-activity time series, decimated on ingest (≤600 pts). */
export interface ActivitySeries {
  t: (number | null)[]; // ms epoch
  hr?: (number | null)[];
  speed?: (number | null)[]; // m/s
  elev?: (number | null)[]; // m
  cadence?: (number | null)[]; // steps/min (both feet)
  power?: (number | null)[]; // W
  dist?: (number | null)[]; // m cumulative
}

export interface LapDTO {
  lapIndex?: number;
  distance?: number; // m
  duration?: number; // s
  averageHR?: number;
  maxHR?: number;
  averageRunCadence?: number;
  strideLength?: number; // cm
  verticalOscillation?: number; // cm
  groundContactTime?: number; // ms
  averageSpeed?: number; // m/s
  [key: string]: unknown;
}

export interface ActivityWeather {
  temp?: number; // °F (Garmin ships Fahrenheit here)
  apparentTemp?: number;
  relativeHumidity?: number;
  windSpeed?: number;
  weatherTypeDTO?: { desc?: string };
  [key: string]: unknown;
}

export interface ActivityData {
  activityId: number;
  series: ActivitySeries | null;
  polyline: [number, number][] | null; // [lat, lon]
  splits: LapDTO[];
  weather: ActivityWeather | null;
  hrZones: HrTimeInZone[] | null;
  fetchedAt: number;
  /** ingest format version; bumped when the series/polyline shaping changes
   *  so cached runs get re-fetched instead of keeping stale-shaped data */
  ingestV?: number;
}

export interface HrTimeInZone {
  zoneNumber?: number;
  secsInZone?: number;
  zoneLowBoundary?: number;
  [key: string]: unknown;
}

/** Per-day wellness metrics, one Dexie row per (metric, date). */
export type WellnessMetric =
  | "sleep"
  | "stress"
  | "hrv"
  | "readiness"
  | "trainingStatus";

/** Metrics fetched via range endpoints, exploded to one row per day. */
export type RangeMetric =
  | "steps"
  | "bodyBattery"
  | "rhr"
  | "maxmet"
  | "racePredictions"
  | "enduranceScore";

export interface WellnessRow {
  metric: WellnessMetric | RangeMetric;
  date: string; // "YYYY-MM-DD"
  payload: unknown;
  fetchedAt: number;
}

export interface DiTokens {
  di_token: string;
  di_refresh_token: string;
  di_client_id: string;
}
