// W15 — stress rhythm: weekday × hour heatmap of average stress over the
// cached window. "When is my nervous system calm?"
import { useMemo } from "react";
import { EChart } from "./EChart";
import { mixHex, tokens, tooltipDefaults } from "./theme";
import { useWellnessRange } from "../../lib/hooks";
import { Card } from "../components/ScreenHeader";
import { useSettings } from "../../store/settingsStore";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function StressRhythm() {
  const rows = useWellnessRange("stress", 90);
  const theme = useSettings((s) => s.theme);

  const cells = useMemo(() => {
    const sum = new Map<string, { total: number; n: number }>();
    for (const row of rows ?? []) {
      const arr = (row.payload as { stressValuesArray?: [number, number][] })?.stressValuesArray;
      if (!arr) continue;
      for (const [ts, level] of arr) {
        if (level == null || level < 0) continue; // -1 unmeasurable, -2 asleep
        const d = new Date(ts);
        const key = `${(d.getDay() + 6) % 7}-${d.getHours()}`; // Mon=0
        const cur = sum.get(key) ?? { total: 0, n: 0 };
        cur.total += level;
        cur.n++;
        sum.set(key, cur);
      }
    }
    const out: [number, number, number, number][] = []; // [hour, dayIdx, avg, n]
    for (const [key, { total, n }] of sum) {
      const [day, hour] = key.split("-").map(Number);
      if (n >= 3) out.push([hour, day, Math.round(total / n), n]);
    }
    return out;
  }, [rows]);

  const option = useMemo(() => {
    if (cells.length < 24) return null;
    const t = tokens();
    return {
      grid: { left: 38, right: 10, top: 8, bottom: 24 },
      tooltip: {
        ...tooltipDefaults(t),
        formatter: (p: { data?: [number, number, number, number] }) => {
          if (!p.data) return "";
          const [hour, day, avg, n] = p.data;
          return `<b>${DAYS[day]} ${String(hour).padStart(2, "0")}:00</b><br/>avg stress ${avg} (${n} samples)`;
        },
      },
      xAxis: {
        type: "category",
        data: Array.from({ length: 24 }, (_, h) => h),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: t.ink3, fontSize: 10, interval: 5, formatter: (v: string) => `${v}h` },
        splitLine: { show: false },
      },
      yAxis: {
        type: "category",
        data: DAYS,
        inverse: true,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: t.ink3, fontSize: 10 },
        splitLine: { show: false },
      },
      visualMap: {
        show: false,
        // ECharts colors by the LAST dimension unless told otherwise — our
        // cells are [hour, day, avg, n], so pin it to the average (dim 2)
        dimension: 2,
        // spread the ramp across the actual value range for contrast
        min: Math.min(...cells.map((c) => c[2])),
        max: Math.max(...cells.map((c) => c[2])),
        inRange: { color: [mixHex(t.recencyLo, t.card, 0.82), t.recencyLo, t.recencyHi] },
      },
      series: [
        {
          type: "heatmap",
          data: cells,
          itemStyle: { borderColor: t.card, borderWidth: 2, borderRadius: 3 },
          emphasis: { itemStyle: { borderColor: t.ink3 } },
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, theme]);

  if (!option) return null;

  return (
    <Card
      kicker="Stress rhythm"
      title="When are you calm?"
      footnote="Average Garmin stress by weekday and hour over the cached window. Brighter = more stressed, scaled to your own range. The dark band overnight is sleep."
    >
      <EChart option={option} height={210} />
    </Card>
  );
}
