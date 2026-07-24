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
    const chart = echarts.init(el, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
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
