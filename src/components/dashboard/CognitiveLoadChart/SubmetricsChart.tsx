import { lazy } from "react";
import SubmetricsTooltip from "./SubmetricsTooltip";
import coffeeMugIcon from "../../../assets/coffeemug.png";

type ChartPoint = {
  x: number;
  load: number | null;
  timestamp: string;
  focus: number | null;
  strain: number | null;
  energy: number | null;
};

type GapSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  focus1: number | null;
  focus2: number | null;
  strain1: number | null;
  strain2: number | null;
  energy1: number | null;
  energy2: number | null;
};

const LazySubmetricsChart = lazy(() =>
  import("recharts").then((recharts) => {
    const GapMarkers = (props: any) => {
      const { gapSegments } = props;
      const { xAxisMap, yAxisMap } = props;

      if (!xAxisMap || !yAxisMap || !gapSegments || gapSegments.length === 0) return null;

      const LINE_HEIGHT_PX = 5;
      const IMAGE_PADDING_PX = 2;
      const BOTTOM_OFFSET_PX = 8;
      const MIN_GAP_WIDTH_FOR_IMAGE = 25;
      const IMAGE_SIZE_MULTIPLIER = 1.75;
      const IMAGE_BOTTOM_PADDING = 2;

      const xAxis = Object.values(xAxisMap)[0] as any;
      const yAxis = Object.values(yAxisMap)[0] as any;

      if (!xAxis || !yAxis) return null;

      const xScale = xAxis.scale;
      const yScale = yAxis.scale;

      const bottomY = yScale(0);
      const lineY = bottomY - BOTTOM_OFFSET_PX;

      const baseHeight = LINE_HEIGHT_PX + IMAGE_PADDING_PX * 2;
      const imageHeight = baseHeight * IMAGE_SIZE_MULTIPLIER;
      const imageWidth = imageHeight * 1.1;

      return (
        <g>
          {gapSegments.map((gap: GapSegment, idx: number) => {
            const x1 = xScale(gap.x1);
            const x2 = xScale(gap.x2);
            const gapWidth = Math.abs(x2 - x1);
            const centerX = (x1 + x2) / 2;
            const showImage = gapWidth >= MIN_GAP_WIDTH_FOR_IMAGE;

            return (
              <g key={`gap-marker-${idx}`}>
                <line
                  x1={x1}
                  y1={lineY}
                  x2={x2}
                  y2={lineY}
                  stroke="#5C78FD"
                  strokeWidth={LINE_HEIGHT_PX}
                  strokeLinecap="round"
                />
                {showImage && (
                  <image
                    x={centerX - imageWidth / 2}
                    y={lineY - imageHeight / 2 - IMAGE_BOTTOM_PADDING}
                    width={imageWidth}
                    height={imageHeight}
                    href={coffeeMugIcon}
                    preserveAspectRatio="xMidYMid meet"
                  />
                )}
              </g>
            );
          })}
        </g>
      );
    };

    const SubmetricsChartComponent = ({
      data,
      gapSegments,
      gapSegmentsForBreakBars,
      xTicks,
      xDomainStart,
      xDomainEnd,
    }: {
      data: ChartPoint[];
      gapSegments: GapSegment[];
      gapSegmentsForBreakBars: GapSegment[];
      xTicks: number[];
      xDomainStart: number;
      xDomainEnd: number;
    }) => {
      return (
        <recharts.ResponsiveContainer width="100%" height="100%">
          <recharts.ComposedChart
            data={data}
            margin={{ top: 5, right: 28, left: 0, bottom: 5 }}
          >
            <recharts.CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="rgba(255,255,255,0.12)"
            />
            <recharts.XAxis
              dataKey="x"
              type="number"
              scale="time"
              domain={[xDomainStart, xDomainEnd]}
              ticks={xTicks}
              interval={0}
              tickFormatter={(ms: number) => `${new Date(ms).getUTCHours()}:00`}
              tick={{ fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <recharts.YAxis
              domain={[0, 100]}
              ticks={[20, 40, 60, 80, 100]}
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={45}
            />
            <recharts.Tooltip content={<SubmetricsTooltip />} />

            {/* Gap dashed lines for each submetric */}
            {gapSegments.map((seg, idx) => (
              <recharts.Line
                key={`gap-focus-${idx}`}
                type="linear"
                dataKey="focus"
                data={[
                  { x: seg.x1, focus: seg.focus1 },
                  { x: seg.x2, focus: seg.focus2 },
                ]}
                stroke="#5C78FD"
                strokeWidth={3.5}
                strokeDasharray="6 6"
                strokeOpacity={0.4}
                dot={false}
                activeDot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
            {gapSegments.map((seg, idx) => (
              <recharts.Line
                key={`gap-strain-${idx}`}
                type="linear"
                dataKey="strain"
                data={[
                  { x: seg.x1, strain: seg.strain1 },
                  { x: seg.x2, strain: seg.strain2 },
                ]}
                stroke="#A07CEF"
                strokeWidth={3.5}
                strokeDasharray="6 6"
                strokeOpacity={0.4}
                dot={false}
                activeDot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
            {gapSegments.map((seg, idx) => (
              <recharts.Line
                key={`gap-energy-${idx}`}
                type="linear"
                dataKey="energy"
                data={[
                  { x: seg.x1, energy: seg.energy1 },
                  { x: seg.x2, energy: seg.energy2 },
                ]}
                stroke="#FF709B"
                strokeWidth={3.5}
                strokeDasharray="6 6"
                strokeOpacity={0.4}
                dot={false}
                activeDot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}

            {/* Gap markers with coffee mug (merged bars only) */}
            <recharts.Customized component={GapMarkers} gapSegments={gapSegmentsForBreakBars} />

            {/* Focus line (blue) */}
            <recharts.Line
              type="monotone"
              dataKey="focus"
              stroke="#5C78FD"
              strokeWidth={3.5}
              dot={false}
              activeDot={{ r: 4, fill: "#5C78FD", stroke: "#fff", strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
            {/* Frustration line (purple) */}
            <recharts.Line
              type="monotone"
              dataKey="strain"
              stroke="#A07CEF"
              strokeWidth={3.5}
              dot={false}
              activeDot={{ r: 4, fill: "#A07CEF", stroke: "#fff", strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
            {/* Workload line (pink) */}
            <recharts.Line
              type="monotone"
              dataKey="energy"
              stroke="#FF709B"
              strokeWidth={3.5}
              dot={false}
              activeDot={{ r: 4, fill: "#FF709B", stroke: "#fff", strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </recharts.ComposedChart>
        </recharts.ResponsiveContainer>
      );
    };
    return { default: SubmetricsChartComponent };
  }),
);

export default LazySubmetricsChart;
