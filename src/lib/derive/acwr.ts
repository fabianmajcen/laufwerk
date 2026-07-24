// Acute:chronic workload ratio from run distances (Garmin's load endpoints are
// empty for this device, so km is the load proxy — documented in the plan).
// acute = km over the last 7 days, chronic = km over the last 28 days / 4.

export interface AcwrResult {
  acuteKm: number;
  chronicKmPerWeek: number;
  /** null when there is too little history for a meaningful ratio */
  ratio: number | null;
}

const MIN_CHRONIC_KM_PER_WEEK = 1;

export function computeAcwr(
  runs: { date: Date; distanceKm: number }[],
  today: Date = new Date(),
): AcwrResult {
  const dayMs = 86400000;
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() + dayMs; // end of today
  let acute = 0;
  let last28 = 0;
  for (const r of runs) {
    const age = end - r.date.getTime();
    if (age < 0 || age > 28 * dayMs) continue;
    last28 += r.distanceKm;
    if (age <= 7 * dayMs) acute += r.distanceKm;
  }
  const chronic = last28 / 4;
  return {
    acuteKm: acute,
    chronicKmPerWeek: chronic,
    ratio: chronic >= MIN_CHRONIC_KM_PER_WEEK ? acute / chronic : null,
  };
}
