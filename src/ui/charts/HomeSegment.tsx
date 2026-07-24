// R15 hero — the auto-detected "home segment": mini-map with the shared
// opening stretch highlighted, plus per-run segment time bars and HR labels.
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { EChart } from "./EChart";
import { tokens, tooltipDefaults, xAxisDefaults, yAxisDefaults } from "./theme";
import { db } from "../../lib/db/schema";
import { getRuns } from "../../lib/db/repo";
import { findSegmentCluster, computeSegmentStats, type HomeSegment as Segment } from "../../lib/derive/segments";
import { fmtDuration } from "../../lib/format";
import { Card } from "../components/ScreenHeader";
import { useSettings } from "../../store/settingsStore";
import type { ActivitySeries } from "../../lib/garmin/types";

interface SegmentBundle {
  segment: Segment;
  routes: { activityId: number; pts: [number, number][] }[];
  dates: Map<number, Date>;
}

export function HomeSegment({ onOpenRun }: { onOpenRun?: (id: number) => void }) {
  const theme = useSettings((s) => s.theme);

  const bundle = useLiveQuery(async (): Promise<SegmentBundle | null> => {
    const runs = await getRuns();
    const routes: { activityId: number; pts: [number, number][] }[] = [];
    const seriesById = new Map<number, ActivitySeries | null>();
    const dates = new Map<number, Date>();
    for (const r of runs) {
      const data = await db.activityData.get(r.activityId);
      if (!data?.polyline || data.polyline.length < 10) continue;
      routes.push({ activityId: r.activityId, pts: data.polyline });
      seriesById.set(r.activityId, data.series);
      dates.set(r.activityId, new Date(r.startTimeLocal.replace(" ", "T")));
    }
    const cluster = findSegmentCluster(routes);
    if (!cluster) return null;
    const segment = computeSegmentStats(cluster, seriesById);
    if (!segment) return null;
    return { segment, routes, dates };
  }, []);

  const option = useMemo(() => {
    if (!bundle) return null;
    const t = tokens();
    const { segment, routes, dates } = bundle;
    const inCluster = new Set(segment.clusterIds);
    const ref = routes.find((r) => r.activityId === segment.refId);
    if (!ref) return null;

    // --- projection shared by all routes in the cluster ---
    const clusterRoutes = routes.filter((r) => inCluster.has(r.activityId));
    const allLat = clusterRoutes.flatMap((r) => r.pts.map((p) => p[0]));
    const allLon = clusterRoutes.flatMap((r) => r.pts.map((p) => p[1]));
    const midLat = (Math.min(...allLat) + Math.max(...allLat)) / 2;
    const mPerLon = 111320 * Math.cos((midLat * Math.PI) / 180);
    const lat0 = Math.min(...allLat);
    const lon0 = Math.min(...allLon);
    const proj = ([lat, lon]: [number, number]) => [(lon - lon0) * mPerLon, (lat - lat0) * 110540];

    const stats = [...segment.stats].sort(
      (a, b) => (dates.get(a.activityId)?.getTime() ?? 0) - (dates.get(b.activityId)?.getTime() ?? 0),
    );
    const labels = stats.map((s) =>
      dates.get(s.activityId)?.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) ?? "?",
    );

    const xsAll = clusterRoutes.flatMap((r) => r.pts.map((p) => proj(p)[0]));
    const ysAll = clusterRoutes.flatMap((r) => r.pts.map((p) => proj(p)[1]));

    return {
      grid: [
        // [0] map (left) and [1] time bars (right)
        { left: 8, right: "56%", top: 12, bottom: 24 },
        { left: "50%", right: 12, top: 12, bottom: 24 },
      ],
      tooltip: {
        ...tooltipDefaults(t),
        formatter: (p: { seriesIndex?: number; dataIndex?: number; seriesId?: string }) => {
          if (p.seriesId !== "segtime" || p.dataIndex == null) return "";
          const s = stats[p.dataIndex];
          return `<b>${labels[p.dataIndex]}</b><br/>${fmtDuration(s.durS)} · ${s.avgHr != null ? Math.round(s.avgHr) + " bpm" : ""}<br/><span style="opacity:.7">tap to open run</span>`;
        },
      },
      xAxis: [
        { type: "value", gridIndex: 0, min: Math.min(...xsAll), max: Math.max(...xsAll), show: false },
        { type: "category", gridIndex: 1, data: labels, ...xAxisDefaults(t) },
      ],
      yAxis: [
        { type: "value", gridIndex: 0, min: Math.min(...ysAll), max: Math.max(...ysAll), show: false },
        {
          type: "value",
          gridIndex: 1,
          scale: true,
          ...yAxisDefaults(t),
          splitNumber: 3,
          axisLabel: { ...yAxisDefaults(t).axisLabel, formatter: (v: number) => fmtDuration(v) },
        },
      ],
      series: [
        // cluster routes, muted
        ...clusterRoutes.map((r) => ({
          type: "line",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: r.pts.map(proj),
          showSymbol: false,
          silent: true,
          lineStyle: { color: t.grid, width: 1.5 },
          z: 1,
        })),
        // the segment itself, crimson
        {
          type: "line",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: ref.pts.slice(0, segment.refEndIdx + 1).map(proj),
          showSymbol: false,
          silent: true,
          lineStyle: { color: t.hr, width: 3, cap: "round" },
          z: 3,
        },
        {
          type: "scatter",
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: [proj(ref.pts[0])],
          symbolSize: 9,
          itemStyle: { color: t.startDot, borderColor: t.card, borderWidth: 1.5 },
          silent: true,
          z: 4,
        },
        // segment time as dot-line (position encoding — bars would need a
        // zero baseline, which hides the 30 s differences that matter here)
        {
          id: "segtime",
          type: "line",
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: stats.map((s) => Number(s.durS.toFixed(0))),
          symbol: "circle",
          symbolSize: 10,
          lineStyle: { color: t.accent, width: 2 },
          itemStyle: { color: t.accent, borderColor: t.card, borderWidth: 2 },
          label: {
            show: true,
            position: "top",
            distance: 7,
            fontSize: 10,
            color: t.ink2,
            formatter: (p: { dataIndex: number }) =>
              stats[p.dataIndex].avgHr != null ? `${Math.round(stats[p.dataIndex].avgHr as number)}♥` : "",
          },
          z: 3,
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle, theme]);

  if (!bundle || !option) return null;
  const { segment } = bundle;
  const sorted = [...segment.stats].sort((a, b) => a.durS - b.durS);
  const best = sorted[0];

  return (
    <Card
      kicker="Home segment"
      title={`Your ${(segment.segLenM / 1000).toFixed(1)} km opener`}
      value={fmtDuration(best.durS)}
      footnote={`Auto-detected: the opening stretch ${segment.stats.length} runs share (within 25 m). Big number = best time; ♥ labels = avg HR — same time at lower HR is fitness.`}
    >
      <EChart
        option={option}
        height={190}
        onEvents={
          onOpenRun
            ? {
                click: (p) => {
                  const q = p as { seriesId?: string; dataIndex?: number };
                  if (q.seriesId === "segtime" && q.dataIndex != null) {
                    const stats = [...bundle.segment.stats].sort(
                      (a, b) =>
                        (bundle.dates.get(a.activityId)?.getTime() ?? 0) -
                        (bundle.dates.get(b.activityId)?.getTime() ?? 0),
                    );
                    if (stats[q.dataIndex]) onOpenRun(stats[q.dataIndex].activityId);
                  }
                },
              }
            : undefined
        }
      />
    </Card>
  );
}
