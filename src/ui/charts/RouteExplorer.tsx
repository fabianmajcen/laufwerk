// The route, annotated: one run's path colored by pace, heart rate or
// elevation. Flat, aspect-correct, readable — what the 3D view wanted to be.
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { EChart } from "./EChart";
import { mixHex, tokens, type Tokens } from "./theme";
import { db } from "../../lib/db/schema";
import { getRuns } from "../../lib/db/repo";
import { cumDistM } from "../../lib/derive/segments";
import { rollingMean } from "../../lib/derive/series";
import { fmtPace } from "../../lib/format";
import { Card } from "../components/ScreenHeader";
import { Legend } from "../components/Legend";
import { useSettings } from "../../store/settingsStore";

type Mode = "pace" | "hr" | "elev";

interface ExplorerRun {
  activityId: number;
  label: string;
  pts: [number, number][]; // [lat, lon]
  /** per polyline point, mapped from the series via cumulative distance */
  values: Record<Mode, (number | null)[]>;
}

const MODE_META: Record<Mode, { label: string; unit: string; lowWord: string; highWord: string }> = {
  pace: { label: "pace", unit: "/km", lowWord: "slower", highWord: "faster" },
  hr: { label: "heart rate", unit: "bpm", lowWord: "lower", highWord: "higher" },
  elev: { label: "elevation", unit: "m", lowWord: "low", highWord: "high" },
};

function baseColor(t: Tokens, mode: Mode): string {
  return mode === "pace" ? t.pace : mode === "hr" ? t.hr : t.elevation;
}

/** Strong three-stop ramp: near-black -> pure metric color -> near-white. */
function rampColor(t: Tokens, mode: Mode, frac: number): string {
  const f = Math.max(0, Math.min(1, frac));
  const base = baseColor(t, mode);
  const dark = mixHex(base, "#000000", 0.72);
  const light = mixHex(base, "#ffffff", 0.62);
  return f < 0.5 ? mixHex(dark, base, f * 2) : mixHex(base, light, (f - 0.5) * 2);
}

function percentile(sorted: number[], p: number): number {
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function RouteExplorer() {
  const theme = useSettings((s) => s.theme);
  const [selected, setSelected] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>("pace");

  const runs = useLiveQuery(async (): Promise<ExplorerRun[]> => {
    const rs = await getRuns();
    const out: ExplorerRun[] = [];
    for (const r of rs) {
      const data = await db.activityData.get(r.activityId);
      const poly = data?.polyline;
      const series = data?.series;
      if (!poly || poly.length < 10 || !series?.dist?.length) continue;

      const polyCum = cumDistM(poly);
      const dist = series.dist;
      const smooth: Record<Mode, (number | null)[]> = {
        pace: rollingMean(
          (series.speed ?? []).map((s) => (s != null && s > 0.5 ? Math.min(1000 / (s * 60), 12) : null)),
          15,
        ),
        hr: rollingMean(series.hr ?? [], 15),
        elev: rollingMean(series.elev ?? [], 20),
      };

      let j = 0;
      const values: Record<Mode, (number | null)[]> = { pace: [], hr: [], elev: [] };
      for (let i = 0; i < poly.length; i++) {
        while (j < dist.length - 1 && (dist[j] ?? 0) < polyCum[i]) j++;
        values.pace.push(smooth.pace[j] ?? null);
        values.hr.push(smooth.hr[j] ?? null);
        values.elev.push(smooth.elev[j] ?? null);
      }

      out.push({
        activityId: r.activityId,
        label: new Date(r.startTimeLocal.replace(" ", "T")).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        }),
        pts: poly,
        values,
      });
    }
    return out;
  }, []);

  const run = useMemo(() => {
    if (!runs?.length) return null;
    return runs.find((r) => r.activityId === selected) ?? runs[0];
  }, [runs, selected]);

  const built = useMemo(() => {
    if (!run) return null;
    const t = tokens();

    const lats = run.pts.map((p) => p[0]);
    const lons = run.pts.map((p) => p[1]);
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const mPerLon = 111320 * Math.cos((midLat * Math.PI) / 180);
    const xs = run.pts.map((p) => (p[1] - lons[0]) * mPerLon);
    const ys = run.pts.map((p) => (p[0] - lats[0]) * 110540);
    const spanX = Math.max(...xs) - Math.min(...xs) || 1;
    const spanY = Math.max(...ys) - Math.min(...ys) || 1;

    const vals = run.values[mode];
    const present = vals.filter((v): v is number => v != null);
    if (present.length < 5) return null;
    // stretch the ramp over this run's p5..p95 so steady runs still show
    // contrast (extremes clamp to the ends)
    const sorted = [...present].sort((a, b) => a - b);
    const vMin = percentile(sorted, 0.05);
    const vMax = percentile(sorted, 0.95);
    const norm = (v: number) => (vMax === vMin ? 0.5 : (v - vMin) / (vMax - vMin));
    // pace: smaller = faster = "high" end of the ramp
    const frac = (v: number) => (mode === "pace" ? 1 - norm(v) : norm(v));

    // short segments, each colored by its local value
    const SEG = 56;
    const per = Math.max(2, Math.ceil(run.pts.length / SEG));
    const segments: { data: [number, number][]; color: string }[] = [];
    for (let s = 0; s < run.pts.length - 1; s += per) {
      const end = Math.min(s + per + 1, run.pts.length);
      const mid = vals[Math.min(s + Math.floor(per / 2), vals.length - 1)];
      segments.push({
        data: xs.slice(s, end).map((x, k) => [x, ys[s + k]] as [number, number]),
        color: mid != null ? rampColor(t, mode, frac(mid)) : t.grid,
      });
    }

    const fmtVal = (v: number) =>
      mode === "pace" ? fmtPace(v) : mode === "hr" ? `${Math.round(v)}` : `${Math.round(v)}`;

    const t2 = tokens();
    const gradientCss = `linear-gradient(to right, ${[0, 0.25, 0.5, 0.75, 1]
      .map((f) => rampColor(t2, mode, f))
      .join(", ")})`;

    return {
      aspect: spanY / spanX,
      gradientCss,
      legend: { low: fmtVal(mode === "pace" ? vMax : vMin), high: fmtVal(mode === "pace" ? vMin : vMax) },
      option: {
        grid: { left: 8, right: 8, top: 8, bottom: 8 },
        xAxis: { type: "value", min: Math.min(...xs), max: Math.max(...xs), show: false },
        yAxis: { type: "value", min: Math.min(...ys), max: Math.max(...ys), show: false },
        series: [
          ...segments.map((seg) => ({
            type: "line",
            data: seg.data,
            showSymbol: false,
            silent: true,
            lineStyle: { color: seg.color, width: 3.5, cap: "round", join: "round" },
            z: 2,
          })),
          {
            type: "scatter",
            data: [[xs[0], ys[0]]],
            symbolSize: 11,
            itemStyle: { color: t.startDot, borderColor: t.card, borderWidth: 2 },
            silent: true,
            z: 3,
          },
        ],
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, mode, theme]);

  if (!runs?.length || !run || !built) return null;
  const meta = MODE_META[mode];
  const height = Math.max(180, Math.min(320, Math.round(340 * built.aspect)));

  return (
    <Card
      kicker="Route explorer"
      title={`${run.label}, colored by ${meta.label}`}
      info="The color ramp stretches over this run's 5th–95th percentile, so even steady runs show contrast (extremes clamp to the ends). Values are smoothed over roughly 15 seconds."
    >
      <div className="mb-2 flex gap-1 overflow-x-auto text-[12px]">
        {runs.map((r) => (
          <button
            key={r.activityId}
            onClick={() => setSelected(r.activityId)}
            className={`shrink-0 rounded-md px-2.5 py-1 ${r.activityId === run.activityId ? "bg-elevated text-ink" : "text-ink-3"}`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="mb-1 flex gap-1 text-[12px]" role="tablist">
        {(Object.keys(MODE_META) as Mode[]).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md py-1.5 capitalize ${mode === m ? "bg-elevated text-ink" : "text-ink-3"}`}
          >
            {MODE_META[m].label}
          </button>
        ))}
      </div>
      <EChart option={built.option} height={height} />
      <div className="mt-2 flex items-center gap-2">
        <span className="tnum text-[11px] text-ink-3">
          {built.legend.low}
          {meta.unit} {meta.lowWord}
        </span>
        <div className="h-2.5 flex-1 rounded-full" style={{ background: built.gradientCss }} />
        <span className="tnum text-[11px] text-ink-3">
          {built.legend.high}
          {meta.unit} {meta.highWord}
        </span>
      </div>
      <Legend items={[{ swatch: "dot", color: "var(--start-dot)", label: "start" }]} />
    </Card>
  );
}
