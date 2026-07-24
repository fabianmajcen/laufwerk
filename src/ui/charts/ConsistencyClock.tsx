// W10 — sleep consistency: floating bars per night from bedtime to wake on a
// clock axis (20:00 → 12:00, midnight centered), colored by sleep score.
import { useMemo } from "react";
import { EChart } from "./EChart";
import { mixHex, tokens, tooltipDefaults, xAxisDefaults } from "./theme";
import { toSleepView, useWellnessRange } from "../../lib/hooks";
import { utcMidnight } from "../../lib/format";
import { Card } from "../components/ScreenHeader";
import { Legend } from "../components/Legend";
import { useSettings } from "../../store/settingsStore";

const AXIS_START_H = 20; // 20:00 on the previous evening

export function ConsistencyClock() {
  const rows = useWellnessRange("sleep", 30);
  const theme = useSettings((s) => s.theme);

  const nights = useMemo(
    () =>
      (rows ?? [])
        .map(toSleepView)
        .filter((v): v is NonNullable<typeof v> => v != null && v.startLocal != null && v.endLocal != null),
    [rows],
  );

  const option = useMemo(() => {
    const t = tokens();

    // hours since 20:00 of the evening before the row's calendar date.
    // Garmin "Local" epochs are wall-clock-as-UTC -> anchor at UTC midnight.
    const toClockHours = (n: { date: string }, tsLocal: number) => {
      const anchor = utcMidnight(n.date) - (24 - AXIS_START_H) * 3600000;
      return (tsLocal - anchor) / 3600000;
    };

    const data = nights.map((n) => {
      const bed = toClockHours(n, n.startLocal!);
      const wake = toClockHours(n, n.endLocal!);
      return { n, bed, wake };
    });

    // color by sleep score, normalized to THIS window's range so the
    // differences are actually visible (scores cluster in a narrow band)
    const scores = data.map((d) => d.n.score).filter((s): s is number => s != null);
    const sMin = scores.length ? Math.min(...scores) : 0;
    const sMax = scores.length ? Math.max(...scores) : 100;

    const meds = (xs: number[]) => {
      const s = [...xs].sort((a, b) => a - b);
      return s.length ? s[Math.floor(s.length / 2)] : null;
    };
    const medBed = meds(data.map((d) => d.bed));
    const medWake = meds(data.map((d) => d.wake));

    const labels = data.map((d) =>
      new Date(d.n.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    );
    const fmtClock = (v: number) => {
      const h = Math.round(((v + AXIS_START_H) % 24) * 10) / 10;
      const hh = Math.floor(h);
      return `${String(hh).padStart(2, "0")}:${String(Math.round((h - hh) * 60)).padStart(2, "0")}`;
    };

    return {
      grid: { left: 40, right: 12, top: 10, bottom: 24 },
      tooltip: {
        ...tooltipDefaults(t),
        formatter: (p: { dataIndex: number }) => {
          const d = data[p.dataIndex];
          if (!d) return "";
          return `<b>${labels[p.dataIndex]}</b><br/>${fmtClock(d.bed)} → ${fmtClock(d.wake)} · score ${d.n.score ?? "–"}`;
        },
      },
      xAxis: { type: "category", data: labels, ...xAxisDefaults(t), axisLabel: { ...xAxisDefaults(t).axisLabel, interval: Math.ceil(data.length / 6) - 1 } },
      yAxis: {
        type: "value",
        min: 0,
        max: 16,
        interval: 4,
        inverse: true, // evening on top, morning below
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: t.grid, width: 1 } },
        axisLabel: { color: t.ink3, fontSize: 11, formatter: (v: number) => fmtClock(v) },
      },
      series: [
        {
          type: "custom",
          renderItem: (
            params: { dataIndex: number },
            api: { coord: (v: [number, number]) => [number, number]; size: (v: [number, number]) => [number, number] },
          ) => {
            const d = data[params.dataIndex];
            const [x, y0] = api.coord([params.dataIndex, d.bed]);
            const [, y1] = api.coord([params.dataIndex, d.wake]);
            const w = Math.min(14, api.size([1, 0])[0] * 0.55);
            const score = d.n.score;
            const frac = score == null || sMax === sMin ? 0.5 : (score - sMin) / (sMax - sMin);
            const color = mixHex(mixHex(t.recencyLo, t.card, 0.35), t.recencyHi, frac);
            return {
              type: "rect",
              shape: { x: x - w / 2, y: y0, width: w, height: Math.max(y1 - y0, 2), r: w / 2 },
              style: { fill: color },
            };
          },
          data: data.map((_, i) => i),
          ...(medBed != null && medWake != null
            ? {
                markLine: {
                  silent: true,
                  symbol: "none",
                  lineStyle: { color: t.ink3, type: "dashed", width: 1 },
                  label: {
                    color: t.ink2,
                    fontSize: 10,
                    formatter: (p: { value: number }) => fmtClock(p.value),
                    position: "insideStartTop",
                    backgroundColor: t.card,
                    padding: [2, 4],
                    borderRadius: 4,
                  },
                  data: [{ yAxis: medBed }, { yAxis: medWake }],
                },
              }
            : {}),
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nights, theme]);

  if (nights.length < 3) return null;

  return (
    <Card
      kicker="Rhythm"
      title="Bed & wake times"
      footnote="Regularity is the biggest free lever."
    >
      <EChart option={option} height={220} />
      <Legend
        items={[
          { swatch: "gradient", gradient: "linear-gradient(to right, color-mix(in srgb, var(--recency-lo) 65%, var(--card)), var(--recency-hi))", label: "worse → better sleep" },
          { swatch: "dash", label: "median bed & wake" },
        ]}
      />
    </Card>
  );
}
