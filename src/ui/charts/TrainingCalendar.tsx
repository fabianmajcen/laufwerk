// W7 — calendar heatmap: cell = sleep score (Garmin readiness is empty for
// this device), ring = run day. The train-recover rhythm at a glance.
import { useMemo } from "react";
import { EChart } from "./EChart";
import { mixHex, tokens, tooltipDefaults } from "./theme";
import { toSleepView, useRuns, useWellnessRange } from "../../lib/hooks";
import { Card } from "../components/ScreenHeader";
import { useSettings } from "../../store/settingsStore";
import { isoDate, parseGarminLocal } from "../../lib/format";

const MONTHS = 3;

export function TrainingCalendar() {
  const rows = useWellnessRange("sleep", MONTHS * 31);
  const runs = useRuns();
  const theme = useSettings((s) => s.theme);

  const option = useMemo(() => {
    const t = tokens();
    const sleepByDate = new Map(
      (rows ?? [])
        .map(toSleepView)
        .filter((v): v is NonNullable<typeof v> => v != null && v.score != null)
        .map((v) => [v.date, v.score as number]),
    );
    const runDates = new Set((runs ?? []).map((r) => isoDate(parseGarminLocal(r.startTimeLocal))));

    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth() - MONTHS + 1, 1);
    const range = [isoDate(start), isoDate(end)];

    const cells: [string, number][] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const ds = isoDate(d);
      const score = sleepByDate.get(ds);
      if (score != null) cells.push([ds, score]);
    }
    const runCells = [...runDates].filter((d) => d >= range[0] && d <= range[1]).map((d) => [d, 1] as [string, number]);

    return {
      tooltip: {
        ...tooltipDefaults(t),
        formatter: (p: { data?: [string, number]; seriesIndex: number }) => {
          const d = p.data?.[0];
          if (!d) return "";
          const score = sleepByDate.get(d);
          return `<b>${new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</b><br/>${
            score != null ? `sleep ${score}` : "no sleep data"
          }${runDates.has(d) ? " · 🏃 run" : ""}`;
        },
      },
      calendar: {
        top: 26,
        left: 34,
        right: 8,
        cellSize: ["auto", 15],
        range,
        splitLine: { show: false },
        itemStyle: { color: "transparent", borderColor: t.card, borderWidth: 2 },
        dayLabel: { color: t.ink3, fontSize: 10, firstDay: 1, nameMap: ["S", "M", "T", "W", "T", "F", "S"] },
        monthLabel: { color: t.ink2, fontSize: 11 },
        yearLabel: { show: false },
      },
      visualMap: {
        show: false,
        min: 40,
        max: 100,
        inRange: {
          color: [mixHex(t.recencyLo, t.card, 0.55), t.recencyLo, t.recencyHi],
        },
        seriesIndex: 0,
      },
      series: [
        { type: "heatmap", coordinateSystem: "calendar", data: cells },
        {
          type: "scatter",
          coordinateSystem: "calendar",
          data: runCells,
          symbol: "circle",
          symbolSize: 13,
          itemStyle: { color: "transparent", borderColor: t.statusGood, borderWidth: 2 },
          silent: true,
          z: 3,
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, runs, theme]);

  return (
    <Card
      kicker="Rhythm"
      title="Last 3 months"
      footnote="Cell brightness = sleep score · green ring = run day."
    >
      <EChart option={option} height={150} />
    </Card>
  );
}
