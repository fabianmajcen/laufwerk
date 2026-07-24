// W13 — HR-zone time per run as 100% stacked bars. All runs are recomputed
// from their HR series against the CURRENT zone boundaries (the newest run's),
// so history stays comparable when zone settings change (e.g. after fixing
// resting HR). The base-phase KPI (easy share) is the card headline.
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { EChart } from "./EChart";
import { mixHex, tokens, tooltipDefaults, xAxisDefaults, yAxisDefaults } from "./theme";
import { db } from "../../lib/db/schema";
import { getRuns } from "../../lib/db/repo";
import { timeInZones, zoneBoundaries } from "../../lib/derive/zones";
import { Card } from "../components/ScreenHeader";
import { Legend } from "../components/Legend";
import { useSettings } from "../../store/settingsStore";

interface RunZones {
  label: string;
  secs: number[]; // Z1..Z5
}

export function ZoneDiscipline() {
  const theme = useSettings((s) => s.theme);
  const result = useLiveQuery(async () => {
    const rs = await getRuns(); // newest first
    // current zone definition = boundaries of the newest run that has them
    let bounds: number[] | null = null;
    for (const r of rs) {
      const data = await db.activityData.get(r.activityId);
      bounds = zoneBoundaries(data?.hrZones);
      if (bounds) break;
    }
    if (!bounds) return null;

    const out: RunZones[] = [];
    for (const r of [...rs].reverse()) {
      const data = await db.activityData.get(r.activityId);
      const secs = timeInZones(data?.series, bounds);
      if (!secs) continue;
      out.push({
        label: new Date(r.startTimeLocal.replace(" ", "T")).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        }),
        secs,
      });
    }
    return { runs: out, bounds };
  }, []);

  const option = useMemo(() => {
    if (!result?.runs.length) return null;
    const { runs } = result;
    const t = tokens();
    // ordinal cool→warm ramp for Z1..Z5 (blue → HR red)
    const zoneColors = [0, 0.25, 0.5, 0.75, 1].map((f) => mixHex(t.cadence, t.hr, f));
    const totals = runs.map((r) => r.secs.reduce((a, b) => a + b, 0) || 1);

    return {
      grid: { left: 34, right: 12, top: 14, bottom: 24 },
      tooltip: {
        ...tooltipDefaults(t),
        trigger: "axis",
        formatter: (ps: { dataIndex: number }[]) => {
          const i = ps[0].dataIndex;
          const r = runs[i];
          const pct = r.secs.map((s) => Math.round((s / totals[i]) * 100));
          const easy = pct[0] + pct[1];
          return `<b>${r.label}</b> · ${easy}% easy<br/>${pct.map((p, z) => `Z${z + 1} ${p}%`).join(" · ")}`;
        },
      },
      xAxis: { type: "category", data: runs.map((r) => r.label), ...xAxisDefaults(t) },
      yAxis: {
        type: "value",
        max: 100,
        ...yAxisDefaults(t),
        splitNumber: 2,
        axisLabel: { ...yAxisDefaults(t).axisLabel, formatter: "{value}%" },
      },
      series: [0, 1, 2, 3, 4].map((z) => ({
        name: `Z${z + 1}`,
        type: "bar",
        stack: "zones",
        barMaxWidth: 22,
        data: runs.map((r, i) => Number(((r.secs[z] / totals[i]) * 100).toFixed(1))),
        itemStyle: { color: zoneColors[z] },
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, theme]);

  if (!result?.runs.length || !option) return null;
  const latest = result.runs[result.runs.length - 1];
  const latestTotal = latest.secs.reduce((a, b) => a + b, 0) || 1;
  const latestEasy = Math.round(((latest.secs[0] + latest.secs[1]) / latestTotal) * 100);

  return (
    <Card
      kicker="Zone discipline"
      title="Time in HR zones"
      value={`${latestEasy}% easy`}
      footnote={`Goal: keep the easy share (Z1+Z2) high. Zones use your current settings (Z2 from ${result.bounds[1]}, Z3 from ${result.bounds[2]} bpm), so every run stays comparable.`}
    >
      <EChart option={option} height={200} />
      <Legend items={[{ swatch: "gradient", gradient: "linear-gradient(to right, var(--cadence), var(--hr))", label: "Z1 easy → Z5 hard" }]} />
    </Card>
  );
}
