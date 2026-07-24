// R5 — the signature visual: every GPS route overlaid on a dark canvas,
// lat-corrected, recency ramp (newest brightest), green start dots.
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { EChart } from "./EChart";
import { recencyColor, tokens } from "./theme";
import { db } from "../../lib/db/schema";
import { getRuns } from "../../lib/db/repo";
import { Card } from "../components/ScreenHeader";
import { Legend, RECENCY_GRADIENT } from "../components/Legend";
import { useSettings } from "../../store/settingsStore";

interface Route {
  activityId: number;
  label: string;
  km: number;
  pts: [number, number][]; // [lat, lon]
}

export function Constellation() {
  const theme = useSettings((s) => s.theme);
  const [selected, setSelected] = useState<number | null>(null);

  const routes = useLiveQuery(async () => {
    const rs = await getRuns();
    const out: Route[] = [];
    for (const r of [...rs].reverse()) {
      const data = await db.activityData.get(r.activityId);
      if (!data?.polyline || data.polyline.length < 2) continue;
      out.push({
        activityId: r.activityId,
        label: new Date(r.startTimeLocal.replace(" ", "T")).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        km: (r.distance ?? 0) / 1000,
        pts: data.polyline,
      });
    }
    return out;
  }, []);

  const { option, aspect } = useMemo(() => {
    if (!routes?.length) return { option: null, aspect: 1 };
    const t = tokens();

    const allLat = routes.flatMap((r) => r.pts.map((p) => p[0]));
    const allLon = routes.flatMap((r) => r.pts.map((p) => p[1]));
    const midLat = (Math.min(...allLat) + Math.max(...allLat)) / 2;
    const mPerLon = 111320 * Math.cos((midLat * Math.PI) / 180);
    const mPerLat = 110540;
    const lat0 = Math.min(...allLat);
    const lon0 = Math.min(...allLon);
    const proj = ([lat, lon]: [number, number]) => [(lon - lon0) * mPerLon, (lat - lat0) * mPerLat];

    const projected = routes.map((r) => r.pts.map(proj));
    const xs = projected.flat().map((p) => p[0]);
    const ys = projected.flat().map((p) => p[1]);
    const spanX = Math.max(...xs) - Math.min(...xs) || 1;
    const spanY = Math.max(...ys) - Math.min(...ys) || 1;
    const n = routes.length;

    return {
      aspect: spanY / spanX,
      option: {
        grid: { left: 6, right: 6, top: 6, bottom: 6 },
        xAxis: { type: "value", min: Math.min(...xs), max: Math.max(...xs), show: false },
        yAxis: { type: "value", min: Math.min(...ys), max: Math.max(...ys), show: false },
        dataZoom: [
          { type: "inside", xAxisIndex: 0 },
          { type: "inside", yAxisIndex: 0 },
        ],
        series: [
          ...routes.map((r, i) => {
            const isSel = selected === r.activityId;
            const dimOthers = selected != null && !isSel;
            return {
              type: "line",
              data: projected[i],
              showSymbol: false,
              silent: false,
              lineStyle: {
                color: dimOthers ? t.grid : recencyColor(t, n > 1 ? i / (n - 1) : 1),
                width: isSel ? 3.5 : 2,
                cap: "round",
                join: "round",
                ...(i === n - 1 && selected == null ? { shadowColor: t.recencyHi, shadowBlur: 8 } : {}),
                ...(isSel ? { shadowColor: t.recencyHi, shadowBlur: 10 } : {}),
              },
              z: isSel ? 4 : 2,
              emphasis: { disabled: true },
            };
          }),
          {
            type: "scatter",
            data: projected.map((p) => p[0]),
            symbolSize: 8,
            itemStyle: { color: t.startDot, borderColor: t.page, borderWidth: 1.5 },
            silent: true,
            z: 5,
          },
        ],
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, selected, theme]);

  if (!routes?.length || !option) return null;
  const totalKm = routes.reduce((a, r) => a + r.km, 0);
  const height = Math.max(200, Math.min(360, Math.round(350 * aspect)));
  const sel = routes.find((r) => r.activityId === selected);

  return (
    <Card
      kicker="Constellation"
      title="Every route"
      value={`${routes.length} runs · ${totalKm.toFixed(0)} km`}
      footnote={sel ? `${sel.label} · ${sel.km.toFixed(1)} km. Tap again to clear.` : "Tap a route to highlight. Pinch to zoom."}
    >
      <div className="mb-2">
        <Legend items={[{ swatch: "gradient", gradient: RECENCY_GRADIENT, label: "older → newer" }, { swatch: "dot", color: "var(--start-dot)", label: "start" }]} />
      </div>
      <div className="-mx-4 overflow-hidden rounded-b-2xl bg-page" style={{ marginBottom: -16 }}>
        <EChart
          option={option}
          height={height}
          touchAction="pan-y pinch-zoom"
          onEvents={{
            click: (p) => {
              const q = p as { seriesIndex?: number; seriesType?: string };
              if (q.seriesType === "line" && q.seriesIndex != null && routes[q.seriesIndex]) {
                const id = routes[q.seriesIndex].activityId;
                setSelected((cur) => (cur === id ? null : id));
              }
            },
          }}
        />
      </div>
    </Card>
  );
}
