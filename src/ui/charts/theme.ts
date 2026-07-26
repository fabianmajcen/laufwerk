// Chart styling read from the CSS custom properties, so charts follow the
// active theme. Call tokens() when building options (not at module load).

export interface Tokens {
  page: string;
  card: string;
  elevated: string;
  ink: string;
  ink2: string;
  ink3: string;
  grid: string;
  axis: string;
  hr: string;
  cadence: string;
  accent: string;
  pace: string;
  elevation: string;
  hrv: string;
  charge: string;
  drain: string;
  recencyLo: string;
  recencyHi: string;
  sleepDeep: string;
  sleepLight: string;
  sleepRem: string;
  sleepAwake: string;
  statusGood: string;
  statusWarn: string;
  statusSerious: string;
  statusCritical: string;
  startDot: string;
}

export function tokens(): Tokens {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string) => s.getPropertyValue(name).trim();
  return {
    page: v("--page"),
    card: v("--card"),
    elevated: v("--elevated"),
    ink: v("--ink"),
    ink2: v("--ink-2"),
    ink3: v("--ink-3"),
    grid: v("--grid"),
    axis: v("--axis"),
    hr: v("--hr"),
    cadence: v("--cadence"),
    accent: v("--accent"),
    pace: v("--pace"),
    elevation: v("--elevation"),
    hrv: v("--hrv"),
    charge: v("--charge"),
    drain: v("--drain"),
    recencyLo: v("--recency-lo"),
    recencyHi: v("--recency-hi"),
    sleepDeep: v("--sleep-deep"),
    sleepLight: v("--sleep-light"),
    sleepRem: v("--sleep-rem"),
    sleepAwake: v("--sleep-awake"),
    statusGood: v("--status-good"),
    statusWarn: v("--status-warn"),
    statusSerious: v("--status-serious"),
    statusCritical: v("--status-critical"),
    startDot: v("--start-dot"),
  };
}

/** Convention defaults: horizontal hairline grid only, ≤5 ticks, 11px muted
 *  tabular axis labels, no chart border. Spread into each chart's axes. */
export function xAxisDefaults(t: Tokens) {
  return {
    axisLine: { lineStyle: { color: t.axis } },
    axisTick: { show: false },
    axisLabel: { color: t.ink3, fontSize: 11, fontFamily: "inherit" },
    splitLine: { show: false },
  };
}

export function yAxisDefaults(t: Tokens) {
  return {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: t.ink3, fontSize: 11 },
    splitLine: { lineStyle: { color: t.grid, width: 1 } },
    splitNumber: 4,
  };
}

export function tooltipDefaults(t: Tokens) {
  return {
    backgroundColor: t.elevated,
    borderColor: "transparent",
    borderRadius: 10,
    padding: [8, 12],
    textStyle: { color: t.ink, fontSize: 12 },
    confine: true,
    // touch-friendly: center the readout above the finger (with fingertip
    // clearance) instead of letting it sit under it; fall below when the
    // touch is near the top edge
    position: (
      point: [number, number],
      _params: unknown,
      _dom: unknown,
      _rect: unknown,
      size: { contentSize: [number, number]; viewSize: [number, number] },
    ) => {
      const [cw, ch] = size.contentSize;
      const vw = size.viewSize[0];
      const x = Math.max(4, Math.min(point[0] - cw / 2, vw - cw - 4));
      const yAbove = point[1] - ch - 30;
      return [x, yAbove >= 4 ? yAbove : point[1] + 36];
    },
  };
}

/** Even local-clock hour ticks for time axes. ECharts time axes ignore
 *  interval/minInterval/maxInterval, so charts pass these explicit values
 *  via axisLabel.customValues. Ticks land on hours where h % stepH === 0. */
export function localHourTicks(tMin: number, tMax: number, stepH: number): number[] {
  const d = new Date(tMin);
  d.setMinutes(0, 0, 0);
  if (d.getTime() < tMin) d.setHours(d.getHours() + 1);
  while (d.getHours() % stepH !== 0) d.setHours(d.getHours() + 1);
  const out: number[] = [];
  while (d.getTime() <= tMax) {
    out.push(d.getTime());
    d.setHours(d.getHours() + stepH);
  }
  return out;
}

/** Sequential recency ramp (single hue): 0 = oldest, 1 = newest. */
export function recencyColor(t: Tokens, frac: number): string {
  return mixHex(t.recencyLo, t.recencyHi, Math.max(0, Math.min(1, frac)));
}

export function mixHex(a: string, b: string, f: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  if (!pa || !pb) return a;
  const c = pa.map((x, i) => Math.round(x + (pb[i] - x) * f));
  return `#${c.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(h: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
