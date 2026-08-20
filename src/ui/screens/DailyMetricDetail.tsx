// Full-page history for the Today chips: steps, resting HR, average stress.
// Chart + the summary stats that make a number meaningful.
import { useMemo, useState } from "react";
import { EChart } from "../charts/EChart";
import { tokens, tooltipDefaults, xAxisDefaults, yAxisDefaults, type Tokens } from "../charts/theme";
import { useWellnessRange } from "../../lib/hooks";
import { Card } from "../components/ScreenHeader";
import { useSettings } from "../../store/settingsStore";

export type DailyMetric = "steps" | "rhr" | "stress";

const CONFIG: Record<
  DailyMetric,
  {
    kicker: string;
    title: string;
    unit: string;
    kind: "bar" | "line";
    source: "steps" | "rhr" | "stress";
    color: (t: Tokens) => string;
    extract: (payload: unknown) => number | null;
    betterWhen?: "higher" | "lower";
  }
> = {
  steps: {
    kicker: "Activity",
    title: "Daily steps",
    unit: "",
    kind: "bar",
    source: "steps",
    color: (t) => t.accent,
    extract: (p) => (p as { totalSteps?: number })?.totalSteps ?? null,
  },
  rhr: {
    kicker: "Recovery",
    title: "Resting heart rate",
    unit: "bpm",
    kind: "line",
    source: "rhr",
    color: (t) => t.hr,
    extract: (p) => (p as { value?: number })?.value ?? null,
    betterWhen: "lower",
  },
  stress: {
    kicker: "Nervous system",
    title: "Average stress",
    unit: "",
    kind: "line",
    source: "stress",
    color: (t) => t.recencyHi,
    extract: (p) => {
      const v = (p as { avgStressLevel?: number })?.avgStressLevel;
      return v != null && v >= 0 ? v : null;
    },
  },
};

export function DailyMetricDetail({ metric }: { metric: DailyMetric }) {
  const cfg = CONFIG[metric];
  const [days, setDays] = useState(30);
  const rows = useWellnessRange(cfg.source, days);
  const theme = useSettings((s) => s.theme);

  const points = useMemo(
    () =>
      (rows ?? [])
        .map((r) => ({ date: r.date, value: cfg.extract(r.payload) }))
        .filter((p): p is { date: string; value: number } => p.value != null),
    [rows, cfg],
  );

  const option = useMemo(() => {
    if (points.length < 3) return null;
    const t = tokens();
    const color = cfg.color(t);
    const avg = points.reduce((a, p) => a + p.value, 0) / points.length;
    const fmtDate = (d: string) =>
      new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

    return {
      grid: { left: 44, right: 14, top: 16, bottom: 26 },
      tooltip: {
        ...tooltipDefaults(t),
        trigger: "axis",
        formatter: (ps: { dataIndex: number }[]) => {
          const p = points[ps[0].dataIndex];
          return `<b>${fmtDate(p.date)}</b><br/>${p.value.toLocaleString("en-GB")}${cfg.unit ? " " + cfg.unit : ""}`;
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
        scale: cfg.kind === "line",
        ...yAxisDefaults(t),
        axisLabel: {
          ...yAxisDefaults(t).axisLabel,
          formatter: (v: number) => (v >= 10000 ? `${Math.round(v / 1000)}k` : String(v)),
        },
      },
      series: [
        {
          type: cfg.kind,
          data: points.map((p) => p.value),
          ...(cfg.kind === "bar"
            ? { itemStyle: { color, borderRadius: [3, 3, 0, 0] }, barMaxWidth: 14 }
            : {
                showSymbol: false,
                lineStyle: { color, width: 2, cap: "round" },
                itemStyle: { color },
              }),
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: t.ink3, type: "dashed", width: 1 },
            label: {
              color: t.ink2,
              fontSize: 10,
              position: "insideEndTop",
              formatter: `avg ${Math.round(avg).toLocaleString("en-GB")}`,
              backgroundColor: t.card,
              padding: [2, 4],
              borderRadius: 4,
            },
            data: [{ yAxis: Number(avg.toFixed(1)) }],
          },
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, cfg, theme]);

  if (!option) return null;

  const values = points.map((p) => p.value);
  const latest = values[values.length - 1];
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const hi = Math.max(...values);
  const lo = Math.min(...values);
  const highlight = cfg.betterWhen === "lower" ? lo : hi;
  // short labels: "30d average" and "best (lowest)" wrapped to two lines in a
  // third-width tile, pushing those numbers a line below the others
  const highlightLabel = cfg.betterWhen === "lower" ? "best" : "highest";

  return (
    <Card kicker={cfg.kicker} title={cfg.title} value={latest.toLocaleString("en-GB")}>
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
      <EChart option={option} height={220} />
      <div className="mt-2 grid grid-cols-3 gap-3">
        <StatTile label={`${days}d avg`} value={Math.round(avg).toLocaleString("en-GB")} unit={cfg.unit} />
        <StatTile label={highlightLabel} value={highlight.toLocaleString("en-GB")} unit={cfg.unit} />
        <StatTile label={cfg.betterWhen === "lower" ? "highest" : "lowest"} value={(cfg.betterWhen === "lower" ? hi : lo).toLocaleString("en-GB")} unit={cfg.unit} />
      </div>
    </Card>
  );
}

function StatTile({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    // h-full + mt-auto: the numbers sit on one baseline across the row even if
    // one label still wraps
    <div className="flex h-full flex-col rounded-xl bg-page p-3">
      <div className="kicker">{label}</div>
      <div className="tnum mt-auto flex items-baseline gap-1 pt-1">
        <span className="text-[18px] font-semibold">{value}</span>
        {unit && <span className="text-[11px] text-ink-3">{unit}</span>}
      </div>
    </div>
  );
}
