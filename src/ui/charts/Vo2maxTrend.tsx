// W9 — VO2max step line over time (it moves in precise decimals via maxmet).
// Race predictions unlock as Garmin computes them (204 for now).
import { useMemo } from "react";
import { EChart } from "./EChart";
import { tokens, tooltipDefaults, xAxisDefaults, yAxisDefaults } from "./theme";
import { useWellnessRange } from "../../lib/hooks";
import { Card } from "../components/ScreenHeader";
import { useSettings } from "../../store/settingsStore";

export function Vo2maxTrend() {
  const rows = useWellnessRange("maxmet", 365);
  const theme = useSettings((s) => s.theme);

  const points = useMemo(
    () =>
      (rows ?? [])
        .map((r) => {
          const generic = (r.payload as { generic?: { vo2MaxPreciseValue?: number } })?.generic;
          return generic?.vo2MaxPreciseValue != null ? { date: r.date, v: generic.vo2MaxPreciseValue } : null;
        })
        .filter((p): p is NonNullable<typeof p> => p != null),
    [rows],
  );

  const option = useMemo(() => {
    if (points.length < 2) return null;
    const t = tokens();
    const fmtDate = (d: string) =>
      new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

    return {
      grid: { left: 34, right: 12, top: 14, bottom: 26 },
      tooltip: {
        ...tooltipDefaults(t),
        trigger: "axis",
        formatter: (ps: { dataIndex: number }[]) => {
          const p = points[ps[0].dataIndex];
          return `<b>${fmtDate(p.date)}</b><br/>VO₂max ${p.v.toFixed(1)}`;
        },
      },
      xAxis: {
        type: "category",
        data: points.map((p) => p.date),
        ...xAxisDefaults(t),
        axisLabel: {
          ...xAxisDefaults(t).axisLabel,
          interval: Math.ceil(points.length / 5) - 1,
          formatter: fmtDate,
        },
      },
      yAxis: { type: "value", scale: true, ...yAxisDefaults(t), splitNumber: 3 },
      series: [
        {
          type: "line",
          step: "end",
          data: points.map((p) => p.v),
          showSymbol: true,
          symbol: "circle",
          symbolSize: 7,
          lineStyle: { color: t.accent, width: 2 },
          itemStyle: { color: t.accent, borderColor: t.card, borderWidth: 2 },
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, theme]);

  if (!option) return null;
  const latest = points[points.length - 1];

  return (
    <Card
      kicker="Fitness"
      title="VO₂max"
      value={latest.v.toFixed(1)}
      info="Garmin's estimate from heart rate vs pace on outdoor runs. Race predictions appear here once there's enough history to compute them."
    >
      <EChart option={option} height={170} />
    </Card>
  );
}
