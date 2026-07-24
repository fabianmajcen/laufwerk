// Tree-shaken ECharts core — register only what the plot catalog uses.
import * as echarts from "echarts/core";
import {
  LineChart,
  BarChart,
  ScatterChart,
  HeatmapChart,
  GaugeChart,
  CustomChart,
} from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  AxisPointerComponent,
  DataZoomInsideComponent,
  VisualMapComponent,
  CalendarComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  LegendComponent,
  GraphicComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  LineChart,
  BarChart,
  ScatterChart,
  HeatmapChart,
  GaugeChart,
  CustomChart,
  GridComponent,
  TooltipComponent,
  AxisPointerComponent,
  DataZoomInsideComponent,
  VisualMapComponent,
  CalendarComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  LegendComponent,
  GraphicComponent,
  CanvasRenderer,
]);

export { echarts };
export type { EChartsCoreOption } from "echarts/core";
