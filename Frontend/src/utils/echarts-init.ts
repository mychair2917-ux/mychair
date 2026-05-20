import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  AxisPointerComponent,
  DataZoomComponent,
  DataZoomInsideComponent,
  DataZoomSliderComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
// Renderer
import { CanvasRenderer } from 'echarts/renderers';

// Register components with echarts
echarts.use([
  BarChart,
  GridComponent,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  LineChart,
  PieChart,
  CanvasRenderer,
  AxisPointerComponent,
  DataZoomComponent,
  DataZoomSliderComponent,
  DataZoomInsideComponent,
]);

export default echarts;
