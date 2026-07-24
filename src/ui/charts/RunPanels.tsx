// The synced per-run panel stack (absorbs the old hr_vs_cadence / hr_vs_pace /
// elevation_vs_hr dual-axis plots): HR, pace (inverted), cadence, elevation as
// stacked mini-panels sharing one x-axis and one crosshair. Pinch to zoom.
import { useMemo, useState } from "react";
import { EChart } from "./EChart";
import { tokens, tooltipDefaults, xAxisDefaults, yAxisDefaults } from "./theme";
import { rollingMean, toRunPoints } from "../../lib/derive/series";
import { fmtPace } from "../../lib/format";
import type { ActivityData } from "../../lib/garmin/types";
import { useSettings } from "../../store/settingsStore";

type XMode = "elapsed" | "distance";

const PANEL_H = 92;
const PANEL_GAP = 38; // room for the swatch+label row without touching the top tick

export function RunPanels({ data }: { data: ActivityData }) {
  const [xMode, setXMode] = useState<XMode>("elapsed");
  const theme = useSettings((s) => s.theme);

  const pts = useMemo(() => toRunPoints(data.series), [data]);

  const option = useMemo(() => {
    if (!pts) return {};
    const t = tokens();

    const x = xMode === "elapsed" ? pts.elapsedMin : pts.distKm.map((d) => d ?? NaN);
    const hr = rollingMean(pts.hr, 15);
    const pace = rollingMean(pts.pace, 15);
    const cadence = rollingMean(pts.cadence, 15);
    const elev = rollingMean(pts.elev, 20);

    const panels: {
      name: string;
      data: (number | null)[];
      color: string;
      area?: boolean;
      invert?: boolean;
      fmt: (v: number) => string;
    }[] = [
      { name: "HR", data: hr, color: t.hr, fmt: (v: number) => `${Math.round(v)} bpm` },
      { name: "Pace", data: pace, color: t.pace, invert: true, fmt: (v: number) => `${fmtPace(v)} /km` },
      { name: "Cadence", data: cadence, color: t.cadence, fmt: (v: number) => `${Math.round(v)} spm` },
      { name: "Elevation", data: elev, color: t.elevation, area: true, fmt: (v: number) => `${Math.round(v)} m` },
    ].filter((p) => p.data.some((v) => v != null));

    const grids = panels.map((_, i) => ({
      left: 44,
      right: 12,
      top: 26 + i * (PANEL_H + PANEL_GAP),
      height: PANEL_H,
    }));

    return {
      grid: grids,
      tooltip: {
        ...tooltipDefaults(t),
        trigger: "axis",
        formatter: (ps: { seriesName: string; value: [number, number]; seriesIndex: number }[]) => {
          const xVal = ps[0]?.value?.[0];
          const head =
            xMode === "elapsed" ? `${xVal?.toFixed(1)} min` : `${xVal?.toFixed(2)} km`;
          const lines = ps
            .filter((p) => p.value?.[1] != null && !Number.isNaN(p.value[1]))
            .map((p) => {
              const panel = panels[p.seriesIndex];
              return `<span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${panel.color};margin-right:6px"></span>${panel.name} ${panel.fmt(p.value[1])}`;
            });
          return `<b>${head}</b><br/>${lines.join("<br/>")}`;
        },
      },
      axisPointer: {
        link: [{ xAxisIndex: "all" }],
        lineStyle: { color: t.ink3, width: 1 },
      },
      dataZoom: [{ type: "inside", xAxisIndex: panels.map((_, i) => i), zoomOnMouseWheel: true }],
      xAxis: panels.map((_, i) => ({
        type: "value",
        gridIndex: i,
        min: "dataMin",
        max: "dataMax",
        ...xAxisDefaults(t),
        axisLabel: {
          ...xAxisDefaults(t).axisLabel,
          show: i === panels.length - 1,
          formatter: (v: number) => (xMode === "elapsed" ? `${Math.round(v)}m` : `${v.toFixed(1)}km`),
        },
      })),
      yAxis: panels.map((p, i) => ({
        type: "value",
        gridIndex: i,
        scale: true,
        inverse: !!p.invert,
        ...yAxisDefaults(t),
        splitNumber: 3,
        axisLabel: {
          ...yAxisDefaults(t).axisLabel,
          formatter: (v: number) => (p.name === "Pace" ? fmtPace(v) : String(Math.round(v))),
        },
      })),
      // panel titles as positioned labels (axis `name` collides in the gaps);
      // identity = colored swatch, text stays in ink tokens
      graphic: panels.flatMap((p, i) => {
        const top = 26 + i * (PANEL_H + PANEL_GAP) - 22;
        return [
          {
            type: "rect",
            left: 8,
            top: top + 2,
            shape: { width: 8, height: 8, r: 4 },
            style: { fill: p.color },
            silent: true,
          },
          {
            type: "text",
            left: 22,
            top,
            style: {
              text: p.name + (p.invert ? "  (up = faster)" : ""),
              fill: t.ink2,
              fontSize: 11,
              fontWeight: 600,
            },
            silent: true,
          },
        ];
      }),
      series: panels.map((p, i) => ({
        name: p.name,
        type: "line",
        xAxisIndex: i,
        yAxisIndex: i,
        data: x.map((xv, j) => [xv, p.data[j]]),
        showSymbol: false,
        lineStyle: { color: p.color, width: 2, cap: "round" },
        ...(p.area ? { areaStyle: { color: p.color, opacity: 0.12 } } : {}),
        connectNulls: false,
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pts, xMode, theme]);

  if (!pts) return null;
  const nPanels = (option as { grid?: unknown[] }).grid?.length ?? 4;
  const height = 26 + nPanels * (PANEL_H + PANEL_GAP);

  return (
    <div>
      <div className="mx-4 mb-2 flex gap-1 rounded-lg bg-card p-1 text-[12px]" role="tablist">
        {(["elapsed", "distance"] as XMode[]).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={xMode === m}
            onClick={() => setXMode(m)}
            className={`flex-1 rounded-md py-1.5 ${xMode === m ? "bg-elevated text-ink" : "text-ink-3"}`}
          >
            {m === "elapsed" ? "by time" : "by distance"}
          </button>
        ))}
      </div>
      <EChart option={option} height={height} className="px-1" />
    </div>
  );
}
