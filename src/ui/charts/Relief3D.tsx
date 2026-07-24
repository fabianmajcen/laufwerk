// R14 — "Relief mode": a run's route in hand-rolled axonometric 3D with 5×
// elevation exaggeration and a rotation slider. No WebGL, no echarts-gl —
// just a projection and a gradient line. The Mauer hills finally look like hills.
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { EChart } from "./EChart";
import { mixHex, tokens, tooltipDefaults } from "./theme";
import { db } from "../../lib/db/schema";
import { getRuns } from "../../lib/db/repo";
import { cumDistM } from "../../lib/derive/segments";
import { rollingMean } from "../../lib/derive/series";
import { Card } from "../components/ScreenHeader";
import { useSettings } from "../../store/settingsStore";

const EXAGGERATION = 5;
const TILT = 0.5; // ground-plane squash (2:1-ish isometric)

interface ReliefRun {
  activityId: number;
  label: string;
  /** [east m, north m, raw elevation m] per polyline point */
  pts: [number, number, number][];
  gainM: number;
}

export function Relief3D() {
  const theme = useSettings((s) => s.theme);
  const [azimuthDeg, setAzimuthDeg] = useState(300);
  const [selected, setSelected] = useState<number | null>(null);

  const reliefRuns = useLiveQuery(async (): Promise<ReliefRun[]> => {
    const runs = await getRuns();
    const out: ReliefRun[] = [];
    for (const r of runs) {
      const data = await db.activityData.get(r.activityId);
      const poly = data?.polyline;
      const series = data?.series;
      if (!poly || poly.length < 10 || !series?.dist?.length || !series.elev?.length) continue;

      // map elevation onto polyline points via cumulative distance
      const polyCum = cumDistM(poly);
      const elevSmooth = rollingMean(series.elev, 20);
      const dist = series.dist;
      let j = 0;
      const elevAt = (d: number): number | null => {
        while (j < dist.length - 1 && (dist[j] ?? 0) < d) j++;
        return elevSmooth[j] ?? null;
      };

      const lat0 = poly[0][0];
      const lon0 = poly[0][1];
      const mPerLon = 111320 * Math.cos((lat0 * Math.PI) / 180);
      const pts: [number, number, number][] = [];
      j = 0;
      for (let i = 0; i < poly.length; i++) {
        const e = elevAt(polyCum[i]);
        if (e == null) continue;
        pts.push([(poly[i][1] - lon0) * mPerLon, (poly[i][0] - lat0) * 110540, e]);
      }
      if (pts.length < 10) continue;

      let gain = 0;
      for (let i = 1; i < pts.length; i++) gain += Math.max(0, pts[i][2] - pts[i - 1][2]);

      out.push({
        activityId: r.activityId,
        label: new Date(r.startTimeLocal.replace(" ", "T")).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        }),
        pts,
        gainM: gain,
      });
    }
    return out;
  }, []);

  const run = useMemo(() => {
    if (!reliefRuns?.length) return null;
    return reliefRuns.find((r) => r.activityId === selected) ?? reliefRuns[0];
  }, [reliefRuns, selected]);

  const option = useMemo(() => {
    if (!run) return null;
    const t = tokens();
    const theta = (azimuthDeg * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    const zMin = Math.min(...run.pts.map((p) => p[2]));
    // center the footprint so rotation spins in place
    const cx = run.pts.reduce((a, p) => a + p[0], 0) / run.pts.length;
    const cy = run.pts.reduce((a, p) => a + p[1], 0) / run.pts.length;

    const project = ([x, y, z]: [number, number, number], exaggerate: boolean) => {
      const u = (x - cx) * cos - (y - cy) * sin;
      const v = (x - cx) * sin + (y - cy) * cos;
      const zEx = exaggerate ? (z - zMin) * EXAGGERATION : 0;
      return [u, v * TILT + zEx, z] as [number, number, number];
    };

    const route = run.pts.map((p) => project(p, true));
    const shadow = run.pts.map((p) => project(p, false));
    const all = [...route, ...shadow];
    const xs = all.map((p) => p[0]);
    const ys = all.map((p) => p[1]);
    const elevs = run.pts.map((p) => p[2]);
    const eMin = Math.min(...elevs);
    const eMax = Math.max(...elevs);

    // color the route by altitude ourselves: split into short segments, each
    // with a color from the copper ramp (visualMap doesn't gradient lines
    // reliably across renderers)
    const rampLo = mixHex(t.elevation, "#000000", 0.4);
    const rampHi = mixHex(t.elevation, "#ffffff", 0.55);
    const elevColor = (e: number) =>
      eMax > eMin ? mixHex(rampLo, rampHi, (e - eMin) / (eMax - eMin)) : t.elevation;

    const SEG = 28;
    const per = Math.max(2, Math.ceil(route.length / SEG));
    const segments: { data: [number, number, number][]; color: string }[] = [];
    for (let s = 0; s < route.length - 1; s += per) {
      const slice = route.slice(s, Math.min(s + per + 1, route.length));
      const midElev = run.pts[Math.min(s + Math.floor(per / 2), run.pts.length - 1)][2];
      segments.push({ data: slice, color: elevColor(midElev) });
    }

    return {
      grid: { left: 8, right: 8, top: 10, bottom: 8 },
      xAxis: { type: "value", min: Math.min(...xs) - 30, max: Math.max(...xs) + 30, show: false },
      yAxis: { type: "value", min: Math.min(...ys) - 20, max: Math.max(...ys) + 20, show: false },
      tooltip: { ...tooltipDefaults(t), show: false },
      series: [
        {
          type: "line",
          data: shadow,
          showSymbol: false,
          silent: true,
          lineStyle: { color: t.grid, width: 1.5 },
          z: 1,
        },
        ...segments.map((seg) => ({
          type: "line",
          data: seg.data,
          showSymbol: false,
          silent: true,
          lineStyle: { color: seg.color, width: 3.5, cap: "round", join: "round" },
          z: 3,
        })),
        {
          type: "scatter",
          data: [route[0]],
          symbolSize: 10,
          itemStyle: { color: t.startDot, borderColor: t.card, borderWidth: 2 },
          silent: true,
          z: 4,
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, azimuthDeg, theme]);

  if (!reliefRuns?.length || !run || !option) return null;

  return (
    <Card
      kicker="Relief mode"
      title={`${run.label} in 3D`}
      value={`+${Math.round(run.gainM)} m`}
      footnote={`Elevation exaggerated ${EXAGGERATION}× (color = altitude, gray = ground track). Drag the slider to rotate.`}
    >
      <div className="mb-2 flex gap-1 overflow-x-auto text-[12px]">
        {reliefRuns.map((r) => (
          <button
            key={r.activityId}
            onClick={() => setSelected(r.activityId)}
            className={`shrink-0 rounded-md px-2.5 py-1 ${r.activityId === run.activityId ? "bg-elevated text-ink" : "text-ink-3"}`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <EChart option={option} height={240} />
      <input
        type="range"
        min={0}
        max={359}
        value={azimuthDeg}
        onChange={(e) => setAzimuthDeg(Number(e.target.value))}
        className="mt-1 w-full accent-[var(--accent)]"
        aria-label="rotate view"
      />
    </Card>
  );
}
