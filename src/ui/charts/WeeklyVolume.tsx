// R7 — weekly volume bars + plan target line, with the cumulative line in a
// thin companion panel below sharing the x-axis (no dual axes, ever).
import { useMemo } from "react";
import { EChart } from "./EChart";
import { tokens, tooltipDefaults, xAxisDefaults, yAxisDefaults } from "./theme";
import { useRuns } from "../../lib/hooks";
import { computeWeeklyVolume } from "../../lib/derive/weekly";
import { parseGarminLocal } from "../../lib/format";
import { Card } from "../components/ScreenHeader";
import { Legend } from "../components/Legend";
import { useSettings } from "../../store/settingsStore";

export function WeeklyVolume({ onOpenWeek }: { onOpenWeek?: (weekStart: string) => void }) {
  const runs = useRuns();
  const theme = useSettings((s) => s.theme);
  const plan = useSettings((s) => s.plan);

  const weekly = useMemo(
    () =>
      computeWeeklyVolume(
        (runs ?? []).map((r) => ({
          date: parseGarminLocal(r.startTimeLocal),
          distanceKm: (r.distance ?? 0) / 1000,
        })),
      ),
    [runs],
  );

  const option = useMemo(() => {
    const t = tokens();
    const labels = weekly.map((w) => {
      const d = new Date(w.weekStart);
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    });
    const maxIdx = weekly.reduce((mi, w, i) => (w.distanceKm > weekly[mi].distanceKm ? i : mi), 0);
    // rough plan target: recent pace (min/km) over last 3 runs → km per planned week
    const recent = [...(runs ?? [])].slice(0, 3);
    const paces = recent
      .map((r) => ((r.duration ?? 0) / 60) / ((r.distance ?? 1) / 1000))
      .filter((p) => isFinite(p) && p > 0);
    const planKm =
      paces.length >= 1
        ? (plan.runsPerWeek * plan.minutesPerRun) / (paces.reduce((a, b) => a + b, 0) / paces.length)
        : null;

    return {
      grid: [
        { left: 34, right: 12, top: 14, height: 156 },
        { left: 34, right: 12, top: 204, height: 68 },
      ],
      tooltip: {
        ...tooltipDefaults(t),
        trigger: "axis",
        formatter: (ps: { dataIndex: number }[]) => {
          const i = ps[0].dataIndex;
          const w = weekly[i];
          return `<b>week of ${labels[i]}</b><br/>${w.distanceKm.toFixed(1)} km · total ${w.cumulativeKm.toFixed(1)} km<br/><span style="opacity:.7">tap for that week's runs</span>`;
        },
      },
      axisPointer: { link: [{ xAxisIndex: "all" }] },
      xAxis: [
        { type: "category", data: labels, gridIndex: 0, ...xAxisDefaults(t), axisLabel: { show: false } },
        { type: "category", data: labels, gridIndex: 1, ...xAxisDefaults(t) },
      ],
      yAxis: [
        {
          type: "value",
          gridIndex: 0,
          ...yAxisDefaults(t),
          // keep the plan line inside the axis range
          max: Math.ceil(Math.max(...weekly.map((w) => w.distanceKm), planKm ?? 0) + 1),
        },
        { type: "value", gridIndex: 1, ...yAxisDefaults(t), splitNumber: 2 },
      ],
      series: [
        {
          type: "bar",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: weekly.map((w, i) => ({
            value: Number(w.distanceKm.toFixed(2)),
            label:
              i === maxIdx || i === weekly.length - 1
                ? { show: true, position: "top", color: t.ink2, fontSize: 11, formatter: "{c} km" }
                : undefined,
          })),
          itemStyle: { color: t.accent, borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 24,
          ...(planKm
            ? {
                markLine: {
                  silent: true,
                  symbol: "none",
                  lineStyle: { color: t.ink3, type: "dashed", width: 1 },
                  label: {
                    color: t.ink3,
                    fontSize: 10,
                    formatter: `plan ${planKm.toFixed(1)}`,
                    position: "insideEndTop",
                  },
                  data: [{ yAxis: Number(planKm.toFixed(2)) }],
                },
              }
            : {}),
        },
        {
          type: "line",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: weekly.map((w) => Number(w.cumulativeKm.toFixed(1))),
          symbol: "circle",
          symbolSize: 6,
          lineStyle: { color: t.ink2, width: 2 },
          itemStyle: { color: t.ink2 },
          silent: true,
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekly, runs, plan, theme]);

  if (weekly.length < 2) return null;

  return (
    <Card
      kicker="Volume"
      title="Weekly km"
      value={`${weekly[weekly.length - 1].cumulativeKm.toFixed(0)} km total`}
      info="Monday-start weeks. The dashed target comes from your plan in Settings (runs per week × minutes, at your recent pace). Tap a bar for that week's runs."
    >
      <EChart
        option={option}
        height={300}
        onEvents={
          onOpenWeek
            ? {
                click: (p) => {
                  const q = p as { seriesType?: string; dataIndex?: number };
                  if (q.seriesType === "bar" && q.dataIndex != null && weekly[q.dataIndex])
                    onOpenWeek(weekly[q.dataIndex].weekStart);
                },
              }
            : undefined
        }
      />
      <Legend items={[{ swatch: "bar", color: "var(--accent)", label: "weekly km" }, { swatch: "dash", label: "plan target" }, { swatch: "line", color: "var(--ink-2)", label: "cumulative (below)" }]} />
    </Card>
  );
}
