import { useEffect, useRef } from "react";
import { echarts, type EChartsCoreOption } from "./echarts";
import type { ECharts } from "echarts/core";

interface Props {
  option: EChartsCoreOption;
  height: number | string;
  className?: string;
  onEvents?: Record<string, (params: unknown) => void>;
  /** vertical swipes scroll the page by default; charts with pinch zoom pass
   *  "pan-y pinch-zoom" */
  touchAction?: string;
}

/** Single ECharts wrapper: init once, resize with container, dispose on
 *  unmount, replace option wholesale (notMerge) so charts stay declarative. */
export function EChart({ option, height, className, onEvents, touchAction = "pan-y" }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);

  useEffect(() => {
    const el = divRef.current;
    if (!el) return;
    // useCoarsePointer widens every hit target for fingers (tapping dots,
    // bars, routes and grabbing the crosshair)
    const chart = echarts.init(el, undefined, { renderer: "canvas", useCoarsePointer: true, pointerSize: 24 });
    chartRef.current = chart;
    // Never let zrender measure the container itself: the Android WebView
    // has been seen wedging a chart at ~1/3 width while the div is fine.
    // Explicit pixel sizes from the layout rect bypass its measurement.
    const applySize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      if (Math.abs(chart.getWidth() - rect.width) > 1 || Math.abs(chart.getHeight() - rect.height) > 1)
        chart.resize({ width: rect.width, height: rect.height });
    };
    const ro = new ResizeObserver(applySize);
    ro.observe(el);
    const raf = requestAnimationFrame(applySize);
    const timers = [250, 1000, 2500].map((ms) => setTimeout(applySize, ms));
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setOption(option, { notMerge: true });
    // re-check the size on every data/theme swap too
    const el = divRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 1 && Math.abs(chart.getWidth() - rect.width) > 1)
        chart.resize({ width: rect.width, height: rect.height });
    }
  }, [option]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onEvents) return;
    for (const [ev, cb] of Object.entries(onEvents)) chart.on(ev, cb);
    return () => {
      if (chart.isDisposed()) return;
      for (const [ev, cb] of Object.entries(onEvents)) chart.off(ev, cb);
    };
  }, [onEvents]);

  return <div ref={divRef} className={className} style={{ height, width: "100%", touchAction }} />;
}
