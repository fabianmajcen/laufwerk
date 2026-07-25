// Stage balance: deep% and REM% per night vs adult reference bands — is the
// architecture of sleep healthy, not just the amount?
import { useMemo } from "react";
import { EChart } from "./EChart";
import { tokens, tooltipDefaults, xAxisDefaults, yAxisDefaults } from "./theme";
import { toSleepView, useWellnessRange } from "../../lib/hooks";
import { computeStageBalance, DEEP_NORM, REM_NORM } from "../../lib/derive/sleepStats";
import { Card } from "../components/ScreenHeader";
import { Legend } from "../components/Legend";
import { useSettings } from "../../store/settingsStore";

export function StageBalance() {
  const rows = useWellnessRange("sleep", 30);
  const theme = useSettings((s) => s.theme);

  const points = useMemo(() => {
    const nights = (rows ?? []).map(toSleepView).filter((v): v is NonNullable<typeof v> => v != null);
    return computeStageBalance(nights);
  }, [rows]);

  const option = useMemo(() => {
    if (points.length < 5) return null;
    const t = tokens();
    const fmtDate = (d: string) =>
      new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

    return {
      grid: { left: 34, right: 12, top: 14, bottom: 24 },
      tooltip: {
        ...tooltipDefaults(t),
        trigger: "axis",
        formatter: (ps: { dataIndex: number }[]) => {
          const p = points[ps[0].dataIndex];
          return `<b>${fmtDate(p.date)}</b><br/>deep ${p.deepPct.toFixed(0)}% · REM ${p.remPct.toFixed(0)}% · light ${p.lightPct.toFixed(0)}%`;
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
      yAxis: {
        type: "value",
        min: 0,
        max: 50,
        interval: 10,
        ...yAxisDefaults(t),
        axisLabel: { ...yAxisDefaults(t).axisLabel, formatter: "{value}%" },
      },
      series: [
        {
          name: "deep %",
          type: "line",
          data: points.map((p) => Number(p.deepPct.toFixed(1))),
          showSymbol: false,
          itemStyle: { color: t.sleepDeep },
          lineStyle: { color: t.sleepDeep, width: 2 },
          markArea: {
            silent: true,
            itemStyle: { color: t.sleepDeep, opacity: 0.1 },
            data: [[{ yAxis: DEEP_NORM[0] }, { yAxis: DEEP_NORM[1] }]],
          },
        },
        {
          name: "REM %",
          type: "line",
          data: points.map((p) => Number(p.remPct.toFixed(1))),
          showSymbol: false,
          itemStyle: { color: t.sleepRem },
          lineStyle: { color: t.sleepRem, width: 2 },
          markArea: {
            silent: true,
            itemStyle: { color: t.sleepRem, opacity: 0.08 },
            data: [[{ yAxis: REM_NORM[0] }, { yAxis: REM_NORM[1] }]],
          },
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, theme]);

  if (!option) return null;
  const last = points[points.length - 1];

  return (
    <Card
      kicker="Architecture"
      title="Deep & REM share"
      value={`${last.deepPct.toFixed(0)}% / ${last.remPct.toFixed(0)}%`}
      info={`Shares of total time in bed. Typical adult ranges: deep ${DEEP_NORM[0]}–${DEEP_NORM[1]}%, REM ${REM_NORM[0]}–${REM_NORM[1]}%. Single nights swing a lot — watch the drift, not one dip.`}
    >
      <EChart option={option} height={190} />
      <Legend items={[{ swatch: "line", color: "var(--sleep-deep)", label: "deep" }, { swatch: "line", color: "var(--sleep-rem)", label: "REM" }, { swatch: "band", color: "var(--ink-2)", label: "typical range" }]} />
    </Card>
  );
}
