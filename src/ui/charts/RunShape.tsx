// R3b — the typical run: median HR and pace vs % of run elapsed with IQR
// bands, latest run overlaid in accent.
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { EChart } from "./EChart";
import { tokens, tooltipDefaults, xAxisDefaults, yAxisDefaults } from "./theme";
import { db } from "../../lib/db/schema";
import { getRuns } from "../../lib/db/repo";
import { toRunPoints, rollingMean, type RunPoints } from "../../lib/derive/series";
import { computeRunShape } from "../../lib/derive/runShape";
import { fmtPace } from "../../lib/format";
import { Card } from "../components/ScreenHeader";
import { useSettings } from "../../store/settingsStore";

const PANEL_H = 96;

export function RunShape() {
  const theme = useSettings((s) => s.theme);
  const [overlay, setOverlay] = useState(true);

  const data = useLiveQuery(async () => {
    const runs = await getRuns();
    const all: RunPoints[] = [];
    let latest: RunPoints | null = null;
    for (const r of runs) {
      const d = await db.activityData.get(r.activityId);
      const pts = toRunPoints(d?.series);
      if (!pts) continue;
      if (!latest) latest = pts; // runs are newest-first
      all.push(pts);
    }
    return { shape: computeRunShape(all), latest };
  }, []);

  const option = useMemo(() => {
    if (!data?.shape) return null;
    const t = tokens();
    const { latest } = data;
    // drop the first 2% — standing-start pace spikes just waste axis range
    const shape = Object.fromEntries(
      Object.entries(data.shape).map(([k, v]) => [k, Array.isArray(v) ? v.slice(2) : v]),
    ) as typeof data.shape;

    // latest run resampled to the same 0-100% grid for the overlay
    const overlayCurve = (values: (number | null)[]) => {
      if (!latest || !overlay) return null;
      const sm = rollingMean(values, 15);
      const total = latest.elapsedMin[latest.elapsedMin.length - 1];
      return shape.grid.map((g) => {
        const target = (g / 100) * total;
        let j = 0;
        while (j < latest.elapsedMin.length - 2 && latest.elapsedMin[j + 1] < target) j++;
        return sm[j];
      });
    };
    const latestHr = overlayCurve(latest?.hr ?? []);
    const latestPace = overlayCurve(latest?.pace ?? []);

    const band = (lo: (number | null)[], hi: (number | null)[], color: string, gridIndex: number) => [
      {
        type: "line",
        xAxisIndex: gridIndex,
        yAxisIndex: gridIndex,
        data: lo,
        showSymbol: false,
        silent: true,
        lineStyle: { width: 0 },
        stack: `band${gridIndex}`,
        z: 1,
      },
      {
        type: "line",
        xAxisIndex: gridIndex,
        yAxisIndex: gridIndex,
        data: hi.map((h, i) => (h != null && lo[i] != null ? h - (lo[i] as number) : null)),
        showSymbol: false,
        silent: true,
        lineStyle: { width: 0 },
        areaStyle: { color, opacity: 0.12 },
        stack: `band${gridIndex}`,
        z: 1,
      },
    ];

    return {
      grid: [
        { left: 40, right: 12, top: 22, height: PANEL_H },
        { left: 40, right: 12, top: 22 + PANEL_H + 34, height: PANEL_H },
      ],
      axisPointer: { link: [{ xAxisIndex: "all" }], lineStyle: { color: t.ink3 } },
      tooltip: {
        ...tooltipDefaults(t),
        trigger: "axis",
        formatter: (ps: { axisValue: number | string; dataIndex: number }[]) => {
          const p = ps[0];
          if (p?.dataIndex == null) return "";
          const hr = shape.hrMedian[p.dataIndex];
          const pace = shape.paceMedian[p.dataIndex];
          return `<b>${p.axisValue}% of run</b><br/>median HR ${hr != null ? Math.round(hr) : "–"} · median pace ${fmtPace(pace)}`;
        },
      },
      xAxis: [0, 1].map((i) => ({
        type: "category",
        gridIndex: i,
        data: shape.grid,
        boundaryGap: false,
        ...xAxisDefaults(t),
        axisLabel: {
          ...xAxisDefaults(t).axisLabel,
          show: i === 1,
          interval: 24,
          formatter: (v: string) => `${v}%`,
        },
      })),
      yAxis: [
        { type: "value", gridIndex: 0, scale: true, ...yAxisDefaults(t), splitNumber: 3 },
        {
          type: "value",
          gridIndex: 1,
          scale: true,
          inverse: true,
          ...yAxisDefaults(t),
          splitNumber: 3,
          axisLabel: { ...yAxisDefaults(t).axisLabel, formatter: (v: number) => fmtPace(v) },
        },
      ],
      series: [
        ...band(shape.hrLo, shape.hrHi, t.hr, 0),
        {
          type: "line",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: shape.hrMedian,
          showSymbol: false,
          lineStyle: { color: t.hr, width: 2.5 },
          z: 3,
        },
        ...(latestHr
          ? [
              {
                type: "line",
                xAxisIndex: 0,
                yAxisIndex: 0,
                data: latestHr,
                showSymbol: false,
                silent: true,
                lineStyle: { color: t.ink2, width: 1.5, type: "dashed" },
                z: 4,
              },
            ]
          : []),
        ...band(shape.paceLo, shape.paceHi, t.pace, 1),
        {
          type: "line",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: shape.paceMedian,
          showSymbol: false,
          lineStyle: { color: t.pace, width: 2.5 },
          z: 3,
        },
        ...(latestPace
          ? [
              {
                type: "line",
                xAxisIndex: 1,
                yAxisIndex: 1,
                data: latestPace,
                showSymbol: false,
                silent: true,
                lineStyle: { color: t.ink2, width: 1.5, type: "dashed" },
                z: 4,
              },
            ]
          : []),
      ],
      graphic: [
        { swatch: t.hr, text: "HR", top: 22 - 17 },
        { swatch: t.pace, text: "Pace  (up = faster)", top: 22 + PANEL_H + 34 - 17 },
      ].flatMap((g) => [
        {
          type: "rect",
          left: 8,
          top: g.top + 2,
          shape: { width: 8, height: 8, r: 4 },
          style: { fill: g.swatch },
          silent: true,
        },
        {
          type: "text",
          left: 22,
          top: g.top,
          style: { text: g.text, fill: t.ink2, fontSize: 11, fontWeight: 600 },
          silent: true,
        },
      ]),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, overlay, theme]);

  if (!data?.shape || !option) return null;

  return (
    <Card
      kicker="Run shape"
      title={`Your typical run (${data.shape.nRuns} runs)`}
      footnote="Solid = median across runs, shaded = middle 50%. Dashed = your latest run."
    >
      <label className="mb-1 flex items-center gap-2 text-[12px] text-ink-3">
        <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} className="accent-[var(--accent)]" />
        overlay latest run
      </label>
      <EChart option={option} height={2 * PANEL_H + 22 + 34 + 26} />
    </Card>
  );
}
