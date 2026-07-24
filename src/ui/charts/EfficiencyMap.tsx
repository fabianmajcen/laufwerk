// R1 — the efficiency map: avg HR vs avg pace per run, pace axis inverted so
// faster is right. Dots on the single-hue recency ramp (newest brightest),
// OLS trend hairline, EF trend readout in the footnote.
import { useMemo } from "react";
import { EChart } from "./EChart";
import { recencyColor, tokens, tooltipDefaults, xAxisDefaults, yAxisDefaults } from "./theme";
import { useRuns } from "../../lib/hooks";
import { fmtPace, parseGarminLocal, speedToPace } from "../../lib/format";
import { linearFit } from "../../lib/derive/series";
import { Card } from "../components/ScreenHeader";
import { Legend, RECENCY_GRADIENT } from "../components/Legend";
import { useSettings } from "../../store/settingsStore";

export function EfficiencyMap({ onOpenRun }: { onOpenRun?: (id: number) => void }) {
  const runs = useRuns();
  const theme = useSettings((s) => s.theme);

  const points = useMemo(
    () =>
      [...(runs ?? [])]
        .reverse() // oldest first
        .map((r) => ({
          id: r.activityId,
          date: parseGarminLocal(r.startTimeLocal),
          pace: speedToPace(r.averageSpeed),
          hr: r.averageHR ?? null,
          km: (r.distance ?? 0) / 1000,
        }))
        .filter((p) => p.pace != null && p.hr != null),
    [runs],
  );

  const option = useMemo(() => {
    const t = tokens();
    const n = points.length;
    const fit = linearFit(
      points.map((p) => p.pace as number),
      points.map((p) => p.hr as number),
    );
    const paces = points.map((p) => p.pace as number);
    const lo = Math.min(...paces) - 0.15;
    const hi = Math.max(...paces) + 0.15;

    return {
      grid: { left: 34, right: 16, top: 14, bottom: 30 },
      tooltip: {
        ...tooltipDefaults(t),
        formatter: (p: { dataIndex: number; seriesType: string }) => {
          if (p.seriesType !== "scatter") return "";
          const pt = points[p.dataIndex];
          return `<b>${pt.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</b><br/>${fmtPace(pt.pace)} /km · ${Math.round(pt.hr as number)} bpm · ${pt.km.toFixed(1)} km<br/><span style="opacity:.7">tap to open run</span>`;
        },
      },
      xAxis: {
        type: "value",
        inverse: true, // faster → right
        min: lo,
        max: hi,
        ...xAxisDefaults(t),
        axisLabel: {
          ...xAxisDefaults(t).axisLabel,
          formatter: (v: number) => fmtPace(v),
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        scale: true,
        minInterval: 5, // ≤5 clean bpm ticks
        ...yAxisDefaults(t),
        axisLabel: { ...yAxisDefaults(t).axisLabel, formatter: "{value} bpm" },
      },
      series: [
        {
          type: "scatter",
          data: points.map((p, i) => ({
            value: [p.pace, p.hr],
            itemStyle: {
              color: recencyColor(t, n > 1 ? i / (n - 1) : 1),
              borderColor: t.card,
              borderWidth: 2,
            },
          })),
          symbolSize: 16,
        },
        ...(fit
          ? [
              {
                type: "line",
                data: [
                  [lo, fit[0] * lo + fit[1]],
                  [hi, fit[0] * hi + fit[1]],
                ],
                symbol: "none",
                silent: true,
                lineStyle: { color: t.ink3, width: 1, type: "dashed" },
              },
            ]
          : []),
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, theme]);

  const efTrend = useMemo(() => {
    if (points.length < 3) return null;
    // EF = speed/HR per run, indexed vs run number, %/month via time span
    const ef = points.map((p) => 1000 / ((p.pace as number) * 60) / (p.hr as number));
    const days = points.map((p) => p.date.getTime() / 86400000);
    const fit = linearFit(days, ef);
    if (!fit) return null;
    const monthlyPct = ((fit[0] * 30.4) / (ef[0] || 1)) * 100;
    return monthlyPct;
  }, [points]);

  if (points.length < 2) return null;

  return (
    <Card
      kicker="Fitness"
      title="Efficiency map"
      value={efTrend != null ? `EF ${efTrend >= 0 ? "+" : ""}${efTrend.toFixed(1)}%/mo` : undefined}
      footnote="Newer dots drifting down-right = same pace at lower heart rate: the base is building."
    >
      <EChart
        option={option}
        height={230}
        onEvents={
          onOpenRun
            ? {
                click: (p) => {
                  const q = p as { dataIndex?: number; seriesType?: string };
                  if (q.seriesType === "scatter" && q.dataIndex != null && points[q.dataIndex])
                    onOpenRun(points[q.dataIndex].id);
                },
              }
            : undefined
        }
      />
      <Legend items={[{ swatch: "gradient", gradient: RECENCY_GRADIENT, label: "older → newer" }, { swatch: "dash", label: "trend" }]} />
    </Card>
  );
}
