// Sleep debt: nightly duration (thin) + 7-night average (thick) against your
// personal Garmin-adjusted sleep need; running debt as the headline.
import { useMemo } from "react";
import { EChart } from "./EChart";
import { tokens, tooltipDefaults, xAxisDefaults, yAxisDefaults } from "./theme";
import { toSleepView, useWellnessRange } from "../../lib/hooks";
import { computeSleepDebt } from "../../lib/derive/sleepStats";
import { fmtHoursMin } from "../../lib/format";
import { Card } from "../components/ScreenHeader";
import { Legend } from "../components/Legend";
import { useSettings } from "../../store/settingsStore";

export function SleepDebt() {
  const rows = useWellnessRange("sleep", 30);
  const theme = useSettings((s) => s.theme);

  const debt = useMemo(() => {
    const nights = (rows ?? []).map(toSleepView).filter((v): v is NonNullable<typeof v> => v != null);
    return computeSleepDebt(nights);
  }, [rows]);

  const option = useMemo(() => {
    if (debt.length < 5) return null;
    const t = tokens();
    const labels = debt.map((d) => d.date);
    const fmtDate = (d: string) =>
      new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const need = debt[debt.length - 1].needMin;

    return {
      grid: { left: 36, right: 12, top: 14, bottom: 24 },
      tooltip: {
        ...tooltipDefaults(t),
        trigger: "axis",
        formatter: (ps: { dataIndex: number }[]) => {
          const d = debt[ps[0].dataIndex];
          return `<b>${fmtDate(d.date)}</b><br/>slept ${fmtHoursMin(d.sleptMin)} (need ${fmtHoursMin(d.needMin)})<br/>debt ${fmtHoursMin(d.debtMin)}`;
        },
      },
      xAxis: {
        type: "category",
        data: labels,
        ...xAxisDefaults(t),
        axisLabel: {
          ...xAxisDefaults(t).axisLabel,
          interval: Math.ceil(debt.length / 5) - 1,
          formatter: fmtDate,
        },
      },
      yAxis: {
        type: "value",
        scale: true,
        minInterval: 30,
        ...yAxisDefaults(t),
        axisLabel: {
          ...yAxisDefaults(t).axisLabel,
          formatter: (v: number) => `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, "0")}`,
        },
      },
      series: [
        {
          name: "nightly",
          type: "line",
          data: debt.map((d) => Math.round(d.sleptMin)),
          showSymbol: false,
          itemStyle: { color: t.sleepLight, opacity: 0.6 },
          lineStyle: { color: t.sleepLight, width: 1.5, opacity: 0.6 },
        },
        {
          name: "7-night avg",
          type: "line",
          data: debt.map((d) => (d.avg7Min != null ? Math.round(d.avg7Min) : null)),
          showSymbol: false,
          itemStyle: { color: t.sleepDeep },
          lineStyle: { color: t.sleepDeep, width: 2.5 },
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: t.ink3, type: "dashed", width: 1 },
            label: { color: t.ink3, fontSize: 10, formatter: `need ${Math.round(need / 60)}h`, position: "insideEndTop" },
            data: [{ yAxis: need }],
          },
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debt, theme]);

  if (!option) return null;
  const current = debt[debt.length - 1];

  return (
    <Card
      kicker="Duration"
      title="Sleep vs your need"
      value={current.debtMin > 30 ? `−${fmtHoursMin(current.debtMin)}` : "✓ rested"}
      info="Your need is Garmin's personal estimate and adjusts with training, HRV and recent sleep. The headline is debt accumulated against it over the last 30 nights."
    >
      <EChart option={option} height={190} />
      <Legend items={[{ swatch: "line", color: "var(--sleep-light)", opacity: 0.6, label: "nightly" }, { swatch: "line", color: "var(--sleep-deep)", label: "7-night avg" }, { swatch: "dash", label: "your need" }]} />
    </Card>
  );
}
