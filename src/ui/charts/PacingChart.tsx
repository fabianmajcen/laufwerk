// R6 — per-km lap pace lines with the emphasis pattern: latest run in accent,
// others muted; date chips switch the highlight.
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { EChart } from "./EChart";
import { tokens, tooltipDefaults, xAxisDefaults, yAxisDefaults } from "./theme";
import { db } from "../../lib/db/schema";
import { getRuns } from "../../lib/db/repo";
import { fmtPace } from "../../lib/format";
import { Card } from "../components/ScreenHeader";
import { Legend } from "../components/Legend";
import { useSettings } from "../../store/settingsStore";

interface RunPacing {
  activityId: number;
  label: string;
  paces: (number | null)[];
}

export function PacingChart() {
  const theme = useSettings((s) => s.theme);
  const runs = useLiveQuery(async () => {
    const rs = await getRuns();
    const out: RunPacing[] = [];
    for (const r of [...rs].reverse()) {
      const data = await db.activityData.get(r.activityId);
      const laps = (data?.splits ?? []).filter((l) => (l.distance ?? 0) >= 200);
      if (laps.length < 2) continue;
      out.push({
        activityId: r.activityId,
        label: new Date(r.startTimeLocal.replace(" ", "T")).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        }),
        paces: laps.map((l) =>
          l.duration && l.distance ? (l.duration / 60) / (l.distance / 1000) : null,
        ),
      });
    }
    return out;
  }, []);

  const [selected, setSelected] = useState<number | null>(null);
  const selId = selected ?? runs?.[runs.length - 1]?.activityId ?? null;

  const option = useMemo(() => {
    if (!runs?.length) return null;
    const t = tokens();
    const maxLaps = Math.max(...runs.map((r) => r.paces.length));
    const highlighted = runs.find((r) => r.activityId === selId);

    return {
      grid: { left: 40, right: 12, top: 12, bottom: 24 },
      tooltip: {
        ...tooltipDefaults(t),
        trigger: "axis",
        formatter: (ps: { seriesName: string; value: number | null; dataIndex: number }[]) => {
          const km = ps[0]?.dataIndex != null ? ps[0].dataIndex + 1 : "?";
          const lines = ps
            .filter((p) => p.value != null && p.seriesName === highlighted?.label)
            .map((p) => `${p.seriesName}: ${fmtPace(p.value as number)} /km`);
          return `<b>km ${km}</b><br/>${lines.join("<br/>") || "–"}`;
        },
      },
      xAxis: {
        type: "category",
        data: Array.from({ length: maxLaps }, (_, i) => String(i + 1)),
        ...xAxisDefaults(t),
      },
      yAxis: {
        type: "value",
        inverse: true, // up = faster
        scale: true,
        ...yAxisDefaults(t),
        axisLabel: { ...yAxisDefaults(t).axisLabel, formatter: (v: number) => fmtPace(v) },
      },
      series: runs.map((r) => {
        const isSel = r.activityId === selId;
        return {
          name: r.label,
          type: "line",
          data: r.paces.map((p) => (p != null ? Number(p.toFixed(3)) : null)),
          showSymbol: isSel,
          symbol: "circle",
          symbolSize: 7,
          lineStyle: { color: isSel ? t.pace : t.grid, width: isSel ? 2.5 : 1.5 },
          itemStyle: { color: t.pace, borderColor: t.card, borderWidth: 2 },
          z: isSel ? 3 : 2,
          emphasis: { disabled: !isSel },
        };
      }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs, selId, theme]);

  if (!runs || runs.length < 2 || !option) return null;

  return (
    <Card kicker="Pacing" title="Per-km splits" footnote="Up = faster.">
      <div className="mb-2 flex gap-1 overflow-x-auto text-[12px]">
        {[...runs].reverse().map((r) => (
          <button
            key={r.activityId}
            onClick={() => setSelected(r.activityId)}
            className={`shrink-0 rounded-md px-2.5 py-1 ${r.activityId === selId ? "bg-elevated text-ink" : "text-ink-3"}`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <EChart option={option} height={200} />
      <Legend items={[{ swatch: "line", color: "var(--pace)", label: "highlighted" }, { swatch: "line", color: "var(--grid)", label: "other runs" }]} />
    </Card>
  );
}
