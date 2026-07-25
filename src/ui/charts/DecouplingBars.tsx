// R4 — aerobic decoupling per run. Bars vs the −5…+5% target band; ≤5% good
// (status color + icon in header, never color alone). 5-run rolling median.
import { useMemo } from "react";
import { EChart } from "./EChart";
import { tokens, tooltipDefaults, xAxisDefaults, yAxisDefaults } from "./theme";
import { useDecouplingSeries } from "../../lib/hooks";
import { DECOUPLING_TARGET_PCT } from "../../lib/derive/decoupling";
import { Card } from "../components/ScreenHeader";
import { Legend } from "../components/Legend";
import { useSettings } from "../../store/settingsStore";

export function DecouplingBars({ onOpenRun }: { onOpenRun?: (id: number) => void }) {
  const series = useDecouplingSeries();
  const theme = useSettings((s) => s.theme);

  const valid = useMemo(() => (series ?? []).filter((r) => r.decoupling != null), [series]);

  const option = useMemo(() => {
    const t = tokens();
    const labels = valid.map((r) =>
      r.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    );
    const values = valid.map((r) => r.decoupling as number);
    const median5 = values.map((_, i) => {
      const win = values.slice(Math.max(0, i - 4), i + 1).sort((a, b) => a - b);
      return win[Math.floor(win.length / 2)];
    });

    return {
      grid: { left: 34, right: 12, top: 14, bottom: 24 },
      tooltip: {
        ...tooltipDefaults(t),
        trigger: "axis",
        formatter: (ps: { dataIndex: number }[]) => {
          const i = ps[0].dataIndex;
          const r = valid[i];
          return `<b>${labels[i]}</b><br/>decoupling ${(r.decoupling as number).toFixed(1)}%<br/><span style="opacity:.7">tap to open run</span>`;
        },
      },
      xAxis: { type: "category", data: labels, ...xAxisDefaults(t) },
      yAxis: {
        type: "value",
        ...yAxisDefaults(t),
        axisLabel: { ...yAxisDefaults(t).axisLabel, formatter: "{value}%" },
      },
      series: [
        {
          type: "bar",
          data: values.map((v) => ({
            value: v,
            itemStyle: {
              color: v <= DECOUPLING_TARGET_PCT ? t.statusGood : t.statusSerious,
              borderRadius: v >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4],
            },
          })),
          barMaxWidth: 24,
          markArea: {
            silent: true,
            itemStyle: { color: t.statusGood, opacity: 0.08 },
            data: [[{ yAxis: -DECOUPLING_TARGET_PCT }, { yAxis: DECOUPLING_TARGET_PCT }]],
          },
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: t.axis, width: 1 },
            label: { show: false },
            data: [{ yAxis: 0 }],
          },
        },
        {
          type: "line",
          data: median5,
          symbol: "none",
          lineStyle: { color: t.ink3, width: 1, type: "dashed" },
          silent: true,
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid, theme]);

  if (!valid.length) return null;
  const latest = valid[valid.length - 1].decoupling as number;
  const good = latest <= DECOUPLING_TARGET_PCT;

  return (
    <Card
      kicker="Aerobic base"
      title="Decoupling per run"
      value={
        <span className="flex items-center gap-1.5">
          <span className={good ? "text-status-good" : "text-status-serious"}>{good ? "✓" : "▲"}</span>
          {latest.toFixed(1)}%
        </span>
      }
      info="Decoupling: how much your pace-to-heart-rate efficiency drops from the first half of a run to the second, warm-up excluded. Staying within ±5% is the classic marker of a well-developed aerobic base. Tap a bar to open that run."
    >
      <EChart
        option={option}
        height={190}
        onEvents={
          onOpenRun
            ? {
                click: (p) => {
                  const i = (p as { dataIndex?: number }).dataIndex;
                  if (i != null && valid[i]) onOpenRun(valid[i].activityId);
                },
              }
            : undefined
        }
      />
      <Legend items={[{ swatch: "bar", color: "var(--status-good)", label: "≤5% good" }, { swatch: "bar", color: "var(--status-serious)", label: ">5% high" }, { swatch: "band", color: "var(--status-good)", label: "target" }, { swatch: "dash", label: "5-run median" }]} />
    </Card>
  );
}
