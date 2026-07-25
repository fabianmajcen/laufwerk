// Full-page technique chart: one form metric per run with proper axes,
// linear trend, target band (cadence), and tap-through to the run.
import { useMemo } from "react";
import { EChart } from "../charts/EChart";
import { tokens, tooltipDefaults, xAxisDefaults, yAxisDefaults } from "../charts/theme";
import { FORM_META, useFormPoints } from "../charts/FormGrid";
import { FORM_DIRECTION, type FormMetrics } from "../../lib/derive/form";
import { linearFit } from "../../lib/derive/series";
import { Card } from "../components/ScreenHeader";
import { Legend } from "../components/Legend";
import { useSettings } from "../../store/settingsStore";

export function FormDetail({
  metric,
  onOpenRun,
}: {
  metric: keyof FormMetrics;
  onOpenRun?: (id: number) => void;
}) {
  const points = useFormPoints();
  const theme = useSettings((s) => s.theme);
  const meta = FORM_META[metric];

  const usable = useMemo(
    () => (points ?? []).filter((p) => p[metric] != null),
    [points, metric],
  );

  const option = useMemo(() => {
    if (usable.length < 2) return null;
    const t = tokens();
    const vals = usable.map((p) => p[metric] as number);
    const labels = usable.map((p) =>
      p.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    );
    const fit = linearFit(vals.map((_, i) => i), vals);

    return {
      grid: { left: 44, right: 16, top: 16, bottom: 26 },
      tooltip: {
        ...tooltipDefaults(t),
        trigger: "axis",
        formatter: (ps: { dataIndex: number; seriesIndex: number }[]) => {
          const p = ps.find((x) => x.seriesIndex === 0);
          if (!p) return "";
          const pt = usable[p.dataIndex];
          return `<b>${labels[p.dataIndex]}</b><br/>${(pt[metric] as number).toFixed(1)} ${meta.unit}<br/><span style="opacity:.7">tap to open run</span>`;
        },
      },
      xAxis: {
        type: "category",
        data: labels,
        ...xAxisDefaults(t),
        axisLabel: { ...xAxisDefaults(t).axisLabel, interval: Math.ceil(usable.length / 6) - 1 },
      },
      yAxis: {
        type: "value",
        scale: true,
        ...yAxisDefaults(t),
        axisLabel: { ...yAxisDefaults(t).axisLabel, formatter: `{value} ${meta.unit}` },
      },
      series: [
        {
          type: "line",
          data: vals.map((v) => Number(v.toFixed(2))),
          symbol: "circle",
          symbolSize: 10,
          lineStyle: { color: t.accent, width: 2, cap: "round" },
          itemStyle: { color: t.accent, borderColor: t.card, borderWidth: 2 },
          ...(meta.band
            ? {
                markArea: {
                  silent: true,
                  itemStyle: { color: t.cadence, opacity: 0.1 },
                  data: [[{ yAxis: meta.band[0] }, { yAxis: meta.band[1] }]],
                },
              }
            : {}),
        },
        ...(fit
          ? [
              {
                type: "line",
                data: vals.map((_, i) => Number((fit[0] * i + fit[1]).toFixed(2))),
                showSymbol: false,
                silent: true,
                lineStyle: { color: t.ink3, width: 1, type: "dashed" },
              },
            ]
          : []),
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usable, metric, theme]);

  if (!option) return null;

  const vals = usable.map((p) => p[metric] as number);
  const latest = vals[vals.length - 1];
  const fit = linearFit(vals.map((_, i) => i), vals);
  const better = fit ? (fit[0] > 0) === (FORM_DIRECTION[metric] === "higher") : null;
  const dirWord = FORM_DIRECTION[metric] === "higher" ? "higher" : "lower";

  return (
    <Card
      kicker={meta.label}
      title="Per run, distance-weighted"
      value={
        <span className="flex items-baseline gap-2">
          {latest.toFixed(1)}
          <span className="text-[13px] text-ink-3">{meta.unit}</span>
          {better != null && (
            <span className={`text-[13px] ${better ? "text-status-good" : "text-status-warn"}`}>
              {better ? "▲ better" : "▼ worse"}
            </span>
          )}
        </span>
      }
      info="Each point is one run's distance-weighted lap average, so short fast laps don't skew it. Dashed: linear trend. Tap a point to open that run."
    >
      <EChart
        option={option}
        height={260}
        onEvents={
          onOpenRun
            ? {
                click: (p) => {
                  const q = p as { dataIndex?: number; seriesIndex?: number };
                  if (q.seriesIndex === 0 && q.dataIndex != null && usable[q.dataIndex])
                    onOpenRun(usable[q.dataIndex].activityId);
                },
              }
            : undefined
        }
      />
      <Legend
        items={[
          { swatch: "dot", color: "var(--accent)", label: "per run" },
          { swatch: "dash", label: `trend (${dirWord} = better)` },
          ...(meta.band ? [{ swatch: "band" as const, color: "var(--cadence)", label: `target ${meta.band[0]}–${meta.band[1]} ${meta.unit}` }] : []),
        ]}
      />
    </Card>
  );
}
