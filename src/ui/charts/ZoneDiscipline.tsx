// W13 — HR-zone time per run as 100% stacked bars; the base-phase KPI is the
// easy share (Z1+Z2), labeled per bar.
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { EChart } from "./EChart";
import { mixHex, tokens, tooltipDefaults, xAxisDefaults, yAxisDefaults } from "./theme";
import { db } from "../../lib/db/schema";
import { getRuns } from "../../lib/db/repo";
import { Card } from "../components/ScreenHeader";
import { useSettings } from "../../store/settingsStore";

interface RunZones {
  label: string;
  secs: number[]; // Z1..Z5
}

export function ZoneDiscipline() {
  const theme = useSettings((s) => s.theme);
  const runs = useLiveQuery(async () => {
    const rs = await getRuns();
    const out: RunZones[] = [];
    for (const r of [...rs].reverse()) {
      const data = await db.activityData.get(r.activityId);
      const zones = data?.hrZones;
      if (!zones?.length) continue;
      const secs = [1, 2, 3, 4, 5].map(
        (z) => zones.find((x) => x.zoneNumber === z)?.secsInZone ?? 0,
      );
      if (secs.every((s) => s === 0)) continue;
      out.push({
        label: new Date(r.startTimeLocal.replace(" ", "T")).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        }),
        secs,
      });
    }
    return out;
  }, []);

  const option = useMemo(() => {
    if (!runs?.length) return null;
    const t = tokens();
    // ordinal cool→warm ramp for Z1..Z5 (blue → HR red)
    const zoneColors = [0, 0.25, 0.5, 0.75, 1].map((f) => mixHex(t.cadence, t.hr, f));
    const totals = runs.map((r) => r.secs.reduce((a, b) => a + b, 0) || 1);

    return {
      grid: { left: 34, right: 12, top: 34, bottom: 24 },
      legend: {
        top: 0,
        left: 0,
        itemWidth: 10,
        itemHeight: 10,
        icon: "circle",
        textStyle: { color: t.ink2, fontSize: 11 },
      },
      tooltip: {
        ...tooltipDefaults(t),
        trigger: "axis",
        formatter: (ps: { dataIndex: number }[]) => {
          const i = ps[0].dataIndex;
          const r = runs[i];
          const pct = r.secs.map((s) => Math.round((s / totals[i]) * 100));
          return `<b>${r.label}</b><br/>${pct.map((p, z) => `Z${z + 1} ${p}%`).join(" · ")}`;
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
        ...(z === 1
          ? {
              label: {
                show: true,
                position: "top",
                fontSize: 10,
                color: t.ink2,
                formatter: (p: { dataIndex: number }) => {
                  const i = p.dataIndex;
                  const easy = Math.round(((runs[i].secs[0] + runs[i].secs[1]) / totals[i]) * 100);
                  return `${easy}% easy`;
                },
              },
            }
          : {}),
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs, theme]);

  if (!option) return null;

  return (
    <Card kicker="Zone discipline" title="Time in HR zones" footnote="Base phase goal: keep the easy share (Z1+Z2) high.">
      <EChart option={option} height={200} />
    </Card>
  );
}
