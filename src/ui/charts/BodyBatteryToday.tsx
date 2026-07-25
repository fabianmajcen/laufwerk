// W6 — today's body battery curve, charge (teal) / drain (orange) two-tone by
// slope sign, current value as the card stat.
import { useMemo } from "react";
import { EChart } from "./EChart";
import { tokens, tooltipDefaults, xAxisDefaults, yAxisDefaults } from "./theme";
import { extractBatteryFromStress, toBodyBatteryView, useLatestWellness } from "../../lib/hooks";
import { Card } from "../components/ScreenHeader";
import { Legend } from "../components/Legend";
import { useSettings } from "../../store/settingsStore";

export function BodyBatteryToday() {
  const row = useLatestWellness("bodyBattery");
  const stressRow = useLatestWellness("stress");
  const theme = useSettings((s) => s.theme);
  const bb = useMemo(() => {
    const view = toBodyBatteryView(row);
    if (!view) return null;
    // the stress payload carries the dense 3-min curve; the daily report only
    // has keyframes. Use the dense one when it covers the same day.
    const dense = stressRow?.date === view.date ? extractBatteryFromStress(stressRow) : [];
    if (dense.length > view.values.length) {
      const levels = dense.map((v) => v[1]);
      return { ...view, values: dense, peak: Math.max(...levels), current: levels[levels.length - 1] };
    }
    return view;
  }, [row, stressRow]);

  const option = useMemo(() => {
    if (!bb || bb.values.length < 2) return null;
    const t = tokens();

    // split into charge/drain segments so each can wear its own color
    const segs: { color: string; data: [number, number | null][] }[] = [];
    let cur: { color: string; data: [number, number | null][] } | null = null;
    for (let i = 1; i < bb.values.length; i++) {
      const [t0, v0] = bb.values[i - 1];
      const [t1, v1] = bb.values[i];
      const color = v1 >= v0 ? t.charge : t.drain;
      if (!cur || cur.color !== color) {
        cur = { color, data: [[t0, v0]] };
        segs.push(cur);
      }
      cur.data.push([t1, v1]);
    }

    return {
      grid: { left: 30, right: 12, top: 10, bottom: 22 },
      tooltip: {
        ...tooltipDefaults(t),
        trigger: "axis",
        formatter: (ps: { value: [number, number] }[]) => {
          const p = ps[ps.length - 1];
          if (!p?.value) return "";
          const d = new Date(p.value[0]);
          return `<b>${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</b><br/>body battery ${p.value[1]}`;
        },
      },
      xAxis: {
        type: "time",
        splitNumber: 6,
        minInterval: 3600 * 1000, // hour steps, never finer
        ...xAxisDefaults(t),
        axisLabel: {
          ...xAxisDefaults(t).axisLabel,
          hideOverlap: true,
          formatter: (v: number) => new Date(v).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        },
      },
      yAxis: { type: "value", min: 0, max: 100, ...yAxisDefaults(t), splitNumber: 2 },
      series: segs.map((s, i) => ({
        type: "line",
        data: s.data,
        showSymbol: false,
        lineStyle: { color: s.color, width: 2, cap: "round" },
        areaStyle: { color: s.color, opacity: 0.1 },
        silent: false,
        z: 2 + (i % 2),
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bb?.date, bb?.values.length, theme]);

  if (!bb || !option) return null;

  return (
    <Card
      kicker="Energy"
      title="Body battery"
      value={bb.current != null ? String(bb.current) : undefined}
      info="Garmin's energy model: recharges during sleep and calm stretches, drains with stress and activity. The curve runs from midnight to now."
      footnote={`charged +${bb.charged ?? "–"} · drained −${bb.drained ?? "–"} today`}
    >
      <EChart option={option} height={150} />
      <Legend items={[{ swatch: "line", color: "var(--charge)", label: "charging" }, { swatch: "line", color: "var(--drain)", label: "draining" }]} />
    </Card>
  );
}
