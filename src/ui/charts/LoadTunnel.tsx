// W8 hero — the injury guard: acute (7d) and chronic (28d/4) load with the
// ACWR ratio against the 0.8–1.3 safe tunnel. Load = km (Garmin's load
// endpoints are empty for this device).
import { useMemo } from "react";
import { EChart } from "./EChart";
import { tokens, tooltipDefaults, xAxisDefaults, yAxisDefaults } from "./theme";
import { useRuns } from "../../lib/hooks";
import { computeAcwr } from "../../lib/derive/acwr";
import { parseGarminLocal, isoDate } from "../../lib/format";
import { Card } from "../components/ScreenHeader";
import { useSettings } from "../../store/settingsStore";

const WINDOW_DAYS = 60;

export function LoadTunnel() {
  const runs = useRuns();
  const theme = useSettings((s) => s.theme);

  const daily = useMemo(() => {
    const rs = (runs ?? []).map((r) => ({
      date: parseGarminLocal(r.startTimeLocal),
      distanceKm: (r.distance ?? 0) / 1000,
    }));
    if (!rs.length) return [];
    const out: { date: string; acute: number; chronicWeekly: number; ratio: number | null }[] = [];
    for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
      const day = new Date(Date.now() - i * 86400000);
      const a = computeAcwr(rs, day);
      out.push({
        date: isoDate(day),
        acute: a.acuteKm,
        chronicWeekly: a.chronicKmPerWeek,
        ratio: a.ratio,
      });
    }
    return out;
  }, [runs]);

  const option = useMemo(() => {
    if (!daily.length) return null;
    const t = tokens();
    const labels = daily.map((d) => d.date);
    const fmtDate = (d: string) =>
      new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

    return {
      grid: [
        { left: 34, right: 12, top: 32, height: 96 },
        { left: 34, right: 12, top: 168, height: 78 },
      ],
      legend: {
        top: 0,
        left: 0,
        itemWidth: 12,
        itemHeight: 2,
        textStyle: { color: t.ink2, fontSize: 11 },
        data: ["acute (7d)", "chronic (28d/4)"],
      },
      axisPointer: { link: [{ xAxisIndex: "all" }] },
      tooltip: {
        ...tooltipDefaults(t),
        trigger: "axis",
        formatter: (ps: { dataIndex: number }[]) => {
          const d = daily[ps[0].dataIndex];
          return `<b>${fmtDate(d.date)}</b><br/>acute ${d.acute.toFixed(1)} km · chronic ${d.chronicWeekly.toFixed(1)} km/wk<br/>ratio ${d.ratio?.toFixed(2) ?? "–"}`;
        },
      },
      xAxis: [0, 1].map((i) => ({
        type: "category",
        gridIndex: i,
        data: labels,
        ...xAxisDefaults(t),
        axisLabel: {
          ...xAxisDefaults(t).axisLabel,
          show: i === 1,
          interval: Math.ceil(daily.length / 5) - 1,
          formatter: fmtDate,
        },
      })),
      yAxis: [
        {
          type: "value",
          gridIndex: 0,
          ...yAxisDefaults(t),
          splitNumber: 2,
          axisLabel: { ...yAxisDefaults(t).axisLabel, formatter: "{value}km" },
        },
        {
          type: "value",
          gridIndex: 1,
          min: 0,
          max: 2,
          interval: 0.5,
          ...yAxisDefaults(t),
        },
      ],
      series: [
        {
          name: "acute (7d)",
          type: "line",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: daily.map((d) => Number(d.acute.toFixed(2))),
          showSymbol: false,
          itemStyle: { color: t.accent },
          lineStyle: { color: t.accent, width: 2 },
        },
        {
          name: "chronic (28d/4)",
          type: "line",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: daily.map((d) => Number(d.chronicWeekly.toFixed(2))),
          showSymbol: false,
          itemStyle: { color: t.ink3 },
          lineStyle: { color: t.ink3, width: 2, type: "dashed" },
        },
        {
          name: "ratio",
          type: "line",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: daily.map((d) => (d.ratio != null ? Number(d.ratio.toFixed(2)) : null)),
          showSymbol: false,
          lineStyle: { color: t.ink, width: 2 },
          markArea: {
            silent: true,
            itemStyle: { color: t.statusGood, opacity: 0.1 },
            data: [[{ yAxis: 0.8 }, { yAxis: 1.3 }]],
          },
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: t.statusSerious, width: 1, type: "dashed" },
            label: { show: false },
            data: [{ yAxis: 1.5 }],
          },
        },
      ],
      graphic: [
        {
          type: "text",
          left: 8,
          top: 148,
          style: { text: "ACWR ratio (0.8–1.3 = safe tunnel)", fill: t.ink2, fontSize: 11, fontWeight: 600 },
          silent: true,
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daily, theme]);

  if (!option) return null;
  const today = daily[daily.length - 1];

  return (
    <Card
      kicker="Training load"
      title="Load tunnel"
      value={today.ratio != null ? today.ratio.toFixed(2) : "–"}
      footnote="Load proxy = km. Ratio above 1.5 (dashed) caps the readiness verdict at Easy. Priority #1 is not getting injured."
    >
      <EChart option={option} height={262} />
    </Card>
  );
}
