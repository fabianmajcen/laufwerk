// W2 — sleep stage stack per night (hours), with the sleep-need line implied
// by the axis; range chips switch 14/30 nights.
import { useMemo, useState } from "react";
import { EChart } from "./EChart";
import { tokens, tooltipDefaults, xAxisDefaults, yAxisDefaults } from "./theme";
import { toSleepView, useWellnessRange } from "../../lib/hooks";
import { Card } from "../components/ScreenHeader";
import { Legend } from "../components/Legend";
import { useSettings } from "../../store/settingsStore";
import { fmtHoursMin } from "../../lib/format";

export function SleepStages({ onOpenNight }: { onOpenNight?: (date: string) => void }) {
  const [days, setDays] = useState(14);
  const rows = useWellnessRange("sleep", days);
  const theme = useSettings((s) => s.theme);

  const nights = useMemo(
    () => (rows ?? []).map(toSleepView).filter((v): v is NonNullable<typeof v> => v != null && v.sleepSeconds != null && v.sleepSeconds > 0),
    [rows],
  );

  const option = useMemo(() => {
    const t = tokens();
    const labels = nights.map((n) =>
      new Date(n.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    );
    const stages = [
      { key: "deepS", name: "Deep", color: t.sleepDeep },
      { key: "lightS", name: "Light", color: t.sleepLight },
      { key: "remS", name: "REM", color: t.sleepRem },
      { key: "awakeS", name: "Awake", color: t.sleepAwake },
    ] as const;

    return {
      grid: { left: 30, right: 12, top: 14, bottom: 24 },
      tooltip: {
        ...tooltipDefaults(t),
        trigger: "axis",
        formatter: (ps: { dataIndex: number }[]) => {
          const n = nights[ps[0].dataIndex];
          if (!n) return "";
          const f = (s: number) => (s / 3600).toFixed(1) + "h";
          return `<b>${labels[ps[0].dataIndex]}</b> · score ${n.score ?? "–"}<br/>deep ${f(n.deepS)} · light ${f(n.lightS)} · REM ${f(n.remS)} · awake ${f(n.awakeS)}`;
        },
      },
      xAxis: { type: "category", data: labels, ...xAxisDefaults(t), axisLabel: { ...xAxisDefaults(t).axisLabel, interval: Math.ceil(nights.length / 7) - 1 } },
      yAxis: {
        type: "value",
        ...yAxisDefaults(t),
        axisLabel: { ...yAxisDefaults(t).axisLabel, formatter: "{value}h" },
      },
      series: stages.map((s) => ({
        name: s.name,
        type: "bar",
        stack: "sleep",
        data: nights.map((n) => Number((n[s.key] / 3600).toFixed(2))),
        itemStyle: { color: s.color },
        barMaxWidth: 18,
        barGap: "30%",
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nights, theme]);

  if (nights.length < 2) return null;
  const avgMin = nights.reduce((a, n) => a + (n.sleepSeconds ?? 0), 0) / nights.length / 60;

  return (
    <Card kicker="Sleep" title="Stages per night" value={`${fmtHoursMin(avgMin)} avg`}>
      <div className="mb-2 flex gap-1 text-[12px]">
        {[14, 30].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`rounded-md px-2.5 py-1 ${days === d ? "bg-elevated text-ink" : "text-ink-3"}`}
          >
            {d} nights
          </button>
        ))}
      </div>
      <EChart
        option={option}
        height={210}
        onEvents={
          onOpenNight
            ? {
                click: (p) => {
                  const i = (p as { dataIndex?: number }).dataIndex;
                  if (i != null && nights[i]) onOpenNight(nights[i].date);
                },
              }
            : undefined
        }
      />
      <Legend items={[{ swatch: "bar", color: "var(--sleep-deep)", label: "deep" }, { swatch: "bar", color: "var(--sleep-light)", label: "light" }, { swatch: "bar", color: "var(--sleep-rem)", label: "REM" }, { swatch: "bar", color: "var(--sleep-awake)", label: "awake" }]} />
    </Card>
  );
}
