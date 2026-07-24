// R10 — the weather lens: run temperature vs avg HR (or pace). Honest about
// the confound: fitter-over-time and warmer-over-summer move together.
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { EChart } from "./EChart";
import { recencyColor, tokens, tooltipDefaults, xAxisDefaults, yAxisDefaults } from "./theme";
import { db } from "../../lib/db/schema";
import { getRuns } from "../../lib/db/repo";
import { fmtPace, parseGarminLocal, speedToPace } from "../../lib/format";
import { linearFit } from "../../lib/derive/series";
import { Card } from "../components/ScreenHeader";
import { useSettings } from "../../store/settingsStore";

type Mode = "hr" | "pace";

interface WPoint {
  activityId: number;
  date: Date;
  tempC: number;
  hr: number | null;
  pace: number | null;
}

export function WeatherLens({ onOpenRun }: { onOpenRun?: (id: number) => void }) {
  const theme = useSettings((s) => s.theme);
  const [mode, setMode] = useState<Mode>("hr");

  const points = useLiveQuery(async (): Promise<WPoint[]> => {
    const runs = await getRuns();
    const out: WPoint[] = [];
    for (const r of [...runs].reverse()) {
      const data = await db.activityData.get(r.activityId);
      const temp = data?.weather?.temp;
      if (temp == null) continue;
      out.push({
        activityId: r.activityId,
        date: parseGarminLocal(r.startTimeLocal),
        tempC: ((temp - 32) * 5) / 9,
        hr: r.averageHR ?? null,
        pace: speedToPace(r.averageSpeed),
      });
    }
    return out;
  }, []);

  const option = useMemo(() => {
    if (!points || points.length < 3) return null;
    const t = tokens();
    const val = (p: WPoint) => (mode === "hr" ? p.hr : p.pace);
    const usable = points.filter((p) => val(p) != null);
    if (usable.length < 3) return null;
    const n = usable.length;

    const fit = linearFit(usable.map((p) => p.tempC), usable.map((p) => val(p) as number));
    const lo = Math.min(...usable.map((p) => p.tempC)) - 1;
    const hi = Math.max(...usable.map((p) => p.tempC)) + 1;

    return {
      grid: { left: 40, right: 14, top: 14, bottom: 30 },
      tooltip: {
        ...tooltipDefaults(t),
        formatter: (p: { dataIndex: number; seriesType: string }) => {
          if (p.seriesType !== "scatter") return "";
          const pt = usable[p.dataIndex];
          return `<b>${pt.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</b><br/>${pt.tempC.toFixed(0)}°C · ${
            mode === "hr" ? `${Math.round(pt.hr as number)} bpm` : `${fmtPace(pt.pace)} /km`
          }`;
        },
      },
      xAxis: {
        type: "value",
        min: lo,
        max: hi,
        name: "temperature °C",
        nameLocation: "middle",
        nameGap: 22,
        nameTextStyle: { color: t.ink3, fontSize: 11 },
        ...xAxisDefaults(t),
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        scale: true,
        inverse: mode === "pace",
        ...yAxisDefaults(t),
        axisLabel: {
          ...yAxisDefaults(t).axisLabel,
          formatter: (v: number) => (mode === "hr" ? `${Math.round(v)}` : fmtPace(v)),
        },
      },
      series: [
        {
          type: "scatter",
          data: usable.map((p, i) => ({
            value: [p.tempC, val(p)],
            itemStyle: {
              color: recencyColor(t, n > 1 ? i / (n - 1) : 1),
              borderColor: t.card,
              borderWidth: 2,
            },
          })),
          symbolSize: 15,
        },
        ...(fit
          ? [
              {
                type: "line",
                data: [
                  [lo, fit[0] * lo + fit[1]],
                  [hi, fit[0] * hi + fit[1]],
                ],
                showSymbol: false,
                silent: true,
                lineStyle: { color: t.ink3, width: 1, type: "dashed" },
              },
            ]
          : []),
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, mode, theme]);

  if (!option) return null;

  return (
    <Card
      kicker="Weather lens"
      title={`Temperature vs ${mode === "hr" ? "heart rate" : "pace"}`}
      footnote="Brighter = more recent. Caveat: you also got fitter as summer warmed up, so read this alongside the efficiency map, not alone."
    >
      <div className="mb-2 flex gap-1 text-[12px]" role="tablist">
        {(["hr", "pace"] as Mode[]).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-md px-2.5 py-1 ${mode === m ? "bg-elevated text-ink" : "text-ink-3"}`}
          >
            {m === "hr" ? "avg HR" : "avg pace"}
          </button>
        ))}
      </div>
      <EChart
        option={option}
        height={200}
        onEvents={
          onOpenRun
            ? {
                click: (p) => {
                  const q = p as { dataIndex?: number; seriesType?: string };
                  if (q.seriesType === "scatter" && q.dataIndex != null && points?.[q.dataIndex])
                    onOpenRun(points[q.dataIndex].activityId);
                },
              }
            : undefined
        }
      />
    </Card>
  );
}
