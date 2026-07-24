// Tile-free route polyline (the run-detail hero). Flat-earth projection with
// latitude-corrected aspect, green start dot — same geometry as the python
// routes_map plot, one run only.
import { useMemo } from "react";
import { EChart } from "./EChart";
import { tokens } from "./theme";
import { useSettings } from "../../store/settingsStore";

export function RouteHero({ polyline }: { polyline: [number, number][] }) {
  const theme = useSettings((s) => s.theme);

  const { option, aspect } = useMemo(() => {
    const t = tokens();
    const lats = polyline.map((p) => p[0]);
    const lons = polyline.map((p) => p[1]);
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const mPerLon = 111320 * Math.cos((midLat * Math.PI) / 180);
    const mPerLat = 110540;
    const xs = polyline.map((p) => (p[1] - lons[0]) * mPerLon);
    const ys = polyline.map((p) => (p[0] - lats[0]) * mPerLat);
    const spanX = Math.max(...xs) - Math.min(...xs) || 1;
    const spanY = Math.max(...ys) - Math.min(...ys) || 1;

    return {
      aspect: spanY / spanX,
      option: {
        grid: { left: 8, right: 8, top: 8, bottom: 8 },
        xAxis: { type: "value", min: Math.min(...xs), max: Math.max(...xs), show: false },
        yAxis: { type: "value", min: Math.min(...ys), max: Math.max(...ys), show: false },
        series: [
          {
            type: "line",
            data: xs.map((x, i) => [x, ys[i]]),
            showSymbol: false,
            lineStyle: { color: t.accent, width: 2.5, cap: "round", join: "round" },
            silent: true,
            z: 2,
          },
          {
            type: "scatter",
            data: [[xs[0], ys[0]]],
            symbolSize: 12,
            itemStyle: { color: t.startDot, borderColor: t.card, borderWidth: 2 },
            silent: true,
            z: 3,
          },
        ],
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polyline, theme]);

  // container height follows the route's real aspect ratio, clamped for phones
  const height = Math.max(140, Math.min(300, Math.round(330 * aspect)));

  return <EChart option={option} height={height} />;
}
