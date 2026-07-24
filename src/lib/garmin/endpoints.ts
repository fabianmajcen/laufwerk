// Typed path builders for the (unofficial) Garmin Connect API.
// Source of truth: the installed python garminconnect package
// (anaconda3/Lib/site-packages/garminconnect/__init__.py).

export interface Endpoint {
  path: string;
  params?: Record<string, string>;
}

export const ep = {
  socialProfile: (): Endpoint => ({ path: "/userprofile-service/socialProfile" }),

  activities: (start: number, limit: number): Endpoint => ({
    path: "/activitylist-service/activities/search/activities",
    params: { start: String(start), limit: String(limit) },
  }),
  activity: (id: number | string): Endpoint => ({ path: `/activity-service/activity/${id}` }),
  activityDetails: (id: number | string): Endpoint => ({
    path: `/activity-service/activity/${id}/details`,
    // server-side downsampling knobs, python defaults
    params: { maxChartSize: "2000", maxPolylineSize: "4000" },
  }),
  activitySplits: (id: number | string): Endpoint => ({ path: `/activity-service/activity/${id}/splits` }),
  activityWeather: (id: number | string): Endpoint => ({ path: `/activity-service/activity/${id}/weather` }),
  activityHrZones: (id: number | string): Endpoint => ({ path: `/activity-service/activity/${id}/hrTimeInZones` }),

  // --- per-day wellness (1 request per calendar date) ---
  sleep: (displayName: string, date: string): Endpoint => ({
    path: `/wellness-service/wellness/dailySleepData/${displayName}`,
    params: { date, nonSleepBufferMinutes: "60" },
  }),
  stress: (date: string): Endpoint => ({ path: `/wellness-service/wellness/dailyStress/${date}` }),
  hrv: (date: string): Endpoint => ({ path: `/hrv-service/hrv/${date}` }),
  trainingReadiness: (date: string): Endpoint => ({
    path: `/metrics-service/metrics/trainingreadiness/${date}`,
  }),
  trainingStatus: (date: string): Endpoint => ({
    path: `/metrics-service/metrics/trainingstatus/aggregated/${date}`,
  }),

  // --- range endpoints (cheap backfill) ---
  bodyBattery: (startDate: string, endDate: string): Endpoint => ({
    path: "/wellness-service/wellness/bodyBattery/reports/daily",
    params: { startDate, endDate },
  }),
  /** max 28 days per request */
  steps: (startDate: string, endDate: string): Endpoint => ({
    path: `/usersummary-service/stats/steps/daily/${startDate}/${endDate}`,
  }),
  rhr: (displayName: string, fromDate: string, untilDate: string): Endpoint => ({
    path: `/userstats-service/wellness/daily/${displayName}`,
    params: { fromDate, untilDate, metricId: "60" },
  }),
  maxmet: (startDate: string, endDate: string): Endpoint => ({
    path: `/metrics-service/metrics/maxmet/daily/${startDate}/${endDate}`,
  }),
  racePredictionsLatest: (displayName: string): Endpoint => ({
    path: `/metrics-service/metrics/racepredictions/latest/${displayName}`,
  }),
  racePredictionsDaily: (displayName: string, fromDate: string, toDate: string): Endpoint => ({
    path: `/metrics-service/metrics/racepredictions/daily/${displayName}`,
    params: { fromCalendarDate: fromDate, toCalendarDate: toDate },
  }),
  enduranceScoreStats: (startDate: string, endDate: string): Endpoint => ({
    path: "/metrics-service/metrics/endurancescore/stats",
    params: { startDate, endDate, aggregation: "weekly" },
  }),

  userSummary: (displayName: string, date: string): Endpoint => ({
    path: `/usersummary-service/usersummary/daily/${displayName}`,
    params: { calendarDate: date },
  }),
};
