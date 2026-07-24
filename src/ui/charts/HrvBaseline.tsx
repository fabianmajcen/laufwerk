// W4 hero — nightly HRV vs the personal baseline band, 7-day average line,
// run days as axis ticks (does training depress HRV?).
import { useMemo, useState } from "react";
import { EChart } from "./EChart";
import { tokens, tooltipDefaults, xAxisDefaults, yAxisDefaults } from "./theme";
import { toHrvView, useRuns, useWellnessRange } from "../../lib/hooks";
import { Card } from "../components/ScreenHeader";
import { Legend } from "../components/Legend";
import { useSettings } from "../../store/settingsStore";
import { parseGarminLocal, isoDate } from "../../lib/format";

export function HrvBaseline() {
  const [days, setDays] = useState(30);
  const rows = useWellnessRange("hrv", days);
  const runs = useRuns();
  const theme = useSettings((s) => s.theme);

  const nights = useMemo(
    () => (rows ?? []).map(toHrvView).filter((v): v is NonNullable<typeof v> => v != null && v.lastNight != null),
    [rows],
  );

  const option = useMemo(() => {
    if (!nights.length) return null;
    const t = tokens();
    const runDates = new Set((runs ?? []).map((r) => isoDate(parseGarminLocal(r.startTimeLocal))));
    const latest = nights[nights.length - 1];
    const bandLo = latest.baselineLow;
    const bandHi = latest.baselineUpper;

    const labels = nights.map((n) => n.date);
    const fmtDate = (d: string) =>
      new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

    return {
      grid: { left: 34, right: 12, top: 14, bottom: 26 },
      tooltip: {
        ...tooltipDefaults(t),
        trigger: "axis",
        formatter: (ps: { dataIndex: number }[]) => {
          const n = nights[ps[0].dataIndex];
          return `<b>${fmtDate(n.date)}</b><br/>HRV ${n.lastNight} ms · 7d ${n.weeklyAvg ?? "–"} ms${runDates.has(n.date) ? "<br/>🏃 run day" : ""}`;
        },
      },
      xAxis: {
        type: "category",
        data: labels,
        ...xAxisDefaults(t),
        axisLabel: {
          ...xAxisDefaults(t).axisLabel,
          interval: Math.ceil(nights.length / 6) - 1,
          formatter: fmtDate,
        },
      },
      yAxis: {
        type: "value",
        scale: true,
        ...yAxisDefaults(t),
        axisLabel: { ...yAxisDefaults(t).axisLabel, formatter: "{value}ms" },
      },
      series: [
        {
          name: "nightly",
          type: "line",
          data: nights.map((n) => n.lastNight),
          showSymbol: false,
          itemStyle: { color: t.hrv, opacity: 0.55 },
          lineStyle: { color: t.hrv, width: 2, opacity: 0.55 },
          ...(bandLo != null && bandHi != null
            ? {
                markArea: {
                  silent: true,
                  itemStyle: { color: t.hrv, opacity: 0.1 },
                  data: [[{ yAxis: bandLo }, { yAxis: bandHi }]],
                },
              }
            : {}),
        },
        {
          name: "7-day avg",
          type: "line",
          data: nights.map((n) => n.weeklyAvg),
          showSymbol: false,
          itemStyle: { color: t.hrv },
          lineStyle: { color: t.hrv, width: 2.5 },
        },
        {
          // run-day markers pinned under the nightly line (precise, unlike axis ticks)
          type: "scatter",
          data: nights.map((n, i) => (runDates.has(n.date) ? { value: [i, n.lastNight], symbolOffset: [0, 12] } : null)).filter(Boolean),
          symbol: "triangle",
          symbolSize: 7,
          itemStyle: { color: t.accent },
          silent: true,
          z: 4,
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nights, runs, theme]);

  if (!option) return null;
  const latest = nights[nights.length - 1];

  return (
    <Card
      kicker="Recovery"
      title="HRV vs baseline"
      value={`${latest.lastNight} ms`}
      footnote={`Status: ${latest.status?.toLowerCase() ?? "-"}.`}
    >
      <div className="mb-2 flex gap-1 text-[12px]">
        {[30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`rounded-md px-2.5 py-1 ${days === d ? "bg-elevated text-ink" : "text-ink-3"}`}
          >
            {d} days
          </button>
        ))}
      </div>
      <EChart option={option} height={200} />
      <Legend
        items={[
          { swatch: "line", color: "var(--hrv)", opacity: 0.55, label: "nightly" },
          { swatch: "line", color: "var(--hrv)", label: "7-day avg" },
          { swatch: "band", color: "var(--hrv)", label: `balanced ${latest.baselineLow ?? "–"}–${latest.baselineUpper ?? "–"} ms` },
          { swatch: "triangle", color: "var(--accent)", label: "run day" },
        ]}
      />
    </Card>
  );
}
