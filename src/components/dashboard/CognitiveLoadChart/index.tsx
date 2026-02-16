import React, { lazy, Suspense, useMemo, useState } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button, Spinner } from "@heroui/react";
import type { CalendarDate } from "@internationalized/date";
import { today, getLocalTimeZone } from "@internationalized/date";
import DateRangePicker from "./DateRangePicker";
import CustomTooltip from "./CustomTooltip";
import LazySubmetricsChart from "./SubmetricsChart";
import SessionBars from "./SessionBars";
import coffeeMugIcon from "../../../assets/coffeemug.png";

// Color interpolation helpers
const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [92, 120, 253];
};

const rgbToHex = (r: number, g: number, b: number): string => {
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
};

const interpolateColor = (
  value: number,
  min: number,
  max: number,
  color1: string,
  color2: string,
): string => {
  const ratio = (value - min) / (max - min);
  const [r1, g1, b1] = hexToRgb(color1);
  const [r2, g2, b2] = hexToRgb(color2);
  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);
  return rgbToHex(r, g, b);
};

const getLoadColor = (load: number): string => {
  if (load <= 15) return "#5C78FD";
  if (load <= 30) return interpolateColor(load, 15, 30, "#5C78FD", "#A07CEF");
  if (load <= 50) return "#A07CEF";
  if (load <= 65) return interpolateColor(load, 50, 65, "#A07CEF", "#FF709B");
  return "#FF709B";
};

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
  // Submetric values at gap boundaries (for dashed lines in submetrics view)
  focus1: number | null;
  focus2: number | null;
  strain1: number | null;
  strain2: number | null;
  energy1: number | null;
  energy2: number | null;
};

type ContinuousSegment = {
  points: ChartPoint[];
  colorStops: Array<{ offset: string; color: string }>;
};

const LazyChart = lazy(() =>
  import("recharts").then((recharts) => {
    // Custom component to render single gradient path
    const GradientPath = (props: any) => {
      const { continuousSegments, uniqueId } = props;
      const { xAxisMap, yAxisMap, activePayload, isTooltipActive } = props;
      
      if (!xAxisMap || !yAxisMap || !continuousSegments || continuousSegments.length === 0) return null;

      const xAxis = Object.values(xAxisMap)[0] as any;
      const yAxis = Object.values(yAxisMap)[0] as any;
      
      if (!xAxis || !yAxis) return null;

      const xScale = xAxis.scale;
      const yScale = yAxis.scale;

      // Find active point for rendering activeDot
      let activeDotPosition: { x: number; y: number } | null = null;
      if (isTooltipActive && activePayload && activePayload.length > 0) {
        const activeData = activePayload[0]?.payload;
        if (activeData && activeData.x != null && activeData.load != null) {
          activeDotPosition = {
            x: xScale(activeData.x),
            y: yScale(activeData.load),
          };
        }
      }

      return (
        <g>
          {continuousSegments.map((segment: ContinuousSegment, segIdx: number) => {
            if (segment.points.length < 2) return null;

            // Build SVG path using Catmull-Rom to Bezier conversion for smooth curves
            const points = segment.points.map(p => ({
              x: xScale(p.x),
              y: yScale(p.load || 0),
            }));

            // Build path string with smooth curves
            let pathD = `M ${points[0].x} ${points[0].y}`;
            
            for (let i = 0; i < points.length - 1; i++) {
              const p0 = points[Math.max(0, i - 1)];
              const p1 = points[i];
              const p2 = points[i + 1];
              const p3 = points[Math.min(points.length - 1, i + 2)];
              
              // Catmull-Rom to Bezier conversion
              const tension = 0.5;
              const cp1x = p1.x + (p2.x - p0.x) * tension / 3;
              const cp1y = p1.y + (p2.y - p0.y) * tension / 3;
              const cp2x = p2.x - (p3.x - p1.x) * tension / 3;
              const cp2y = p2.y - (p3.y - p1.y) * tension / 3;
              
              pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
            }

            // Build area path (same line path + close to bottom)
            const areaPathD = pathD + 
              ` L ${points[points.length - 1].x} ${yScale(0)}` +
              ` L ${points[0].x} ${yScale(0)} Z`;

            const gradientId = `gradient-${uniqueId}-${segIdx}`;
            const areaGradientId = `area-gradient-${uniqueId}-${segIdx}`;

            return (
              <g key={`segment-${segIdx}`}>
                {/* Gradient definition for line */}
                <defs>
                  <linearGradient
                    id={gradientId}
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    {segment.colorStops.map((stop, idx) => (
                      <stop
                        key={idx}
                        offset={stop.offset}
                        stopColor={stop.color}
                      />
                    ))}
                  </linearGradient>
                  {/* Area gradient (vertical fade) */}
                  <linearGradient
                    id={areaGradientId}
                    x1="0%"
                    y1="0%"
                    x2="0%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor="#A07CEF" stopOpacity={0.13} />
                    <stop offset="100%" stopColor="#A07CEF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                {/* Area fill */}
                <path
                  d={areaPathD}
                  fill={`url(#${areaGradientId})`}
                  stroke="none"
                />
                {/* Main line with gradient */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={`url(#${gradientId})`}
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          })}
          {/* Active dot rendered at correct data point position */}
          {activeDotPosition && (
            <circle
              cx={activeDotPosition.x}
              cy={activeDotPosition.y}
              r={6}
              fill="#A07CEF"
              stroke="#fff"
              strokeWidth={2}
              style={{ pointerEvents: 'none' }}
            />
          )}
        </g>
      );
    };

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

      const baseHeight = LINE_HEIGHT_PX + (IMAGE_PADDING_PX * 2);
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

    const ChartComponent = ({
      data,
      gapSegments,
      gapSegmentsForBreakBars,
      xTicks,
      xDomainStart,
      xDomainEnd,
      continuousSegments,
      uniqueId,
    }: {
      data: ChartPoint[];
      gapSegments: GapSegment[];
      gapSegmentsForBreakBars: GapSegment[];
      xTicks: number[];
      xDomainStart: number;
      xDomainEnd: number;
      continuousSegments: ContinuousSegment[];
      uniqueId: string;
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
            <recharts.Tooltip content={<CustomTooltip />} />
            
            {/* Gap dashed lines */}
            {gapSegments.map((seg, idx) => (
              <recharts.Line
                key={`gap-segment-${idx}`}
                type="linear"
                dataKey="load"
                data={[
                  { x: seg.x1, load: seg.y1 },
                  { x: seg.x2, load: seg.y2 },
                ]}
                stroke={seg.color}
                strokeWidth={4}
                strokeDasharray="6 6"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={0.5}
                dot={false}
                activeDot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
            
            {/* Custom gradient path - renders SINGLE path per continuous segment */}
            <recharts.Customized 
              component={GradientPath} 
              continuousSegments={continuousSegments}
              uniqueId={uniqueId}
            />
            
            {/* Gap markers with coffee mug (merged bars only) */}
            <recharts.Customized component={GapMarkers} gapSegments={gapSegmentsForBreakBars} />
            
            {/* Invisible line for tooltip interaction */}
            <recharts.Line
              type="linear"
              dataKey="load"
              stroke="transparent"
              strokeWidth={20}
              dot={false}
              activeDot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </recharts.ComposedChart>
        </recharts.ResponsiveContainer>
      );
    };
    return { default: ChartComponent };
  }),
);

interface SessionData {
  id: string;
  timestamp_start: string;
  timestamp_end: string;
  length: number;
  score_total: number | null;
  category_share: Record<string, number>;
  // Actual activity timestamps from behavioral_metrics_log
  activity_start: string | null;
  activity_end: string | null;
}

interface CognitiveLoadChartProps {
  data: Array<{
    timestamp: string;
    load: number;
    focus: number;
    strain: number;
    energy: number;
  }>;
  sessions?: SessionData[];
  selectedDate: CalendarDate;
  onDateChange: (date: CalendarDate) => void;
  firstDate: string;
  isLoading?: boolean;
}

const CognitiveLoadChart: React.FC<CognitiveLoadChartProps> = ({
  data,
  sessions = [],
  selectedDate,
  onDateChange,
  firstDate,
  isLoading = false,
}) => {
  const [chartView, setChartView] = useState<"total" | "submetrics">("total");

  const todayDate = today(getLocalTimeZone());
  const isToday = selectedDate.compare(todayDate) === 0;

  // Unique ID for this chart instance to prevent gradient ID conflicts
  const uniqueId = useMemo(() => Math.random().toString(36).substr(2, 9), []);

  const parseTimestampMs = (timestamp: string): number | null => {
    const direct = Date.parse(timestamp);
    if (!Number.isNaN(direct)) return direct;

    if (timestamp.includes(" ") && !timestamp.includes("T")) {
      const normalized = `${timestamp.replace(" ", "T")}Z`;
      const parsed = Date.parse(normalized);
      if (!Number.isNaN(parsed)) return parsed;
    }

    return null;
  };

  const {
    chartData,
    gapSegments,
    gapSegmentsForBreakBars,
    xTicks,
    xDomainStart,
    xDomainEnd,
    continuousSegments,
  } = useMemo(() => {
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const GAP_THRESHOLD_MS = 7 * 60 * 1000;

    const points: ChartPoint[] = data
      .map((item) => {
        const x = parseTimestampMs(item.timestamp);
        if (x === null) return null;
        return {
          x,
          timestamp: item.timestamp,
          load: item.load,
          focus: item.focus,
          strain: item.strain,
          energy: item.energy,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .sort((a, b) => a.x - b.x);

    const buildHourTicks = (xs: number[]): { xTicks: number[]; xDomainStart: number; xDomainEnd: number } => {
      if (xs.length === 0) return { xTicks: [], xDomainStart: 0, xDomainEnd: 0 };

      const startHourMs = Math.floor(xs[0] / ONE_HOUR_MS) * ONE_HOUR_MS;
      const endHourMs = Math.ceil(xs[xs.length - 1] / ONE_HOUR_MS) * ONE_HOUR_MS;

      const allHourTicks: number[] = [];
      for (let t = startHourMs; t <= endHourMs; t += ONE_HOUR_MS) {
        allHourTicks.push(t);
      }

      const selectEvenlySpaced = (ticks: number[], desiredCount: number): number[] => {
        if (ticks.length <= desiredCount) return ticks;
        if (desiredCount <= 2) return [ticks[0], ticks[ticks.length - 1]];

        const lastIdx = ticks.length - 1;
        const selectedIndices = Array.from({ length: desiredCount }, (_, i) =>
          Math.floor((i * lastIdx) / (desiredCount - 1)),
        );

        const uniqueSorted = Array.from(new Set(selectedIndices)).sort((a, b) => a - b);
        if (uniqueSorted[0] !== 0) uniqueSorted.unshift(0);
        if (uniqueSorted[uniqueSorted.length - 1] !== lastIdx) uniqueSorted.push(lastIdx);

        return uniqueSorted.map((idx) => ticks[idx]);
      };

      const chooseDisplayedTicks = (ticks: number[]): number[] => {
        if (ticks.length <= 5) return ticks;

        const middleHoursCount = ticks.length - 2;
        const desiredCount = middleHoursCount % 2 === 0 ? 4 : 5;
        return selectEvenlySpaced(ticks, desiredCount);
      };

      return { xTicks: chooseDisplayedTicks(allHourTicks), xDomainStart: startHourMs, xDomainEnd: endHourMs };
    };

    const { xTicks, xDomainStart, xDomainEnd } = buildHourTicks(points.map((p) => p.x));

    // Identify gaps and split into continuous segments
    const gaps: GapSegment[] = [];
    const continuousSegments: ContinuousSegment[] = [];
    let currentSegmentPoints: ChartPoint[] = [];

    for (let i = 0; i < points.length; i++) {
      const current = points[i];
      
      if (current.load == null) continue;
      
      currentSegmentPoints.push(current);

      const next = points[i + 1];
      if (!next || next.load == null) {
        // End of continuous segment
        if (currentSegmentPoints.length >= 2) {
          // Calculate color stops for this segment
          const segStart = currentSegmentPoints[0].x;
          const segEnd = currentSegmentPoints[currentSegmentPoints.length - 1].x;
          const segRange = segEnd - segStart;
          
          const colorStops = currentSegmentPoints.map(p => ({
            offset: segRange > 0 ? `${((p.x - segStart) / segRange) * 100}%` : "0%",
            color: getLoadColor(p.load || 0),
          }));

          continuousSegments.push({
            points: [...currentSegmentPoints],
            colorStops,
          });
        }
        currentSegmentPoints = [];
        continue;
      }

      const delta = next.x - current.x;
      if (delta > GAP_THRESHOLD_MS) {
        // Gap detected - finish current segment and record gap
        const avgLoad = (current.load + (next.load || 0)) / 2;
        const gapColor = getLoadColor(avgLoad);
        
        gaps.push({ 
          x1: current.x, 
          y1: current.load, 
          x2: next.x, 
          y2: next.load || 0,
          color: gapColor,
          focus1: current.focus,
          focus2: next.focus,
          strain1: current.strain,
          strain2: next.strain,
          energy1: current.energy,
          energy2: next.energy,
        });

        // Finish current segment
        if (currentSegmentPoints.length >= 2) {
          const segStart = currentSegmentPoints[0].x;
          const segEnd = currentSegmentPoints[currentSegmentPoints.length - 1].x;
          const segRange = segEnd - segStart;
          
          const colorStops = currentSegmentPoints.map(p => ({
            offset: segRange > 0 ? `${((p.x - segStart) / segRange) * 100}%` : "0%",
            color: getLoadColor(p.load || 0),
          }));

          continuousSegments.push({
            points: [...currentSegmentPoints],
            colorStops,
          });
        }
        currentSegmentPoints = [];
      }
    }

    // Handle final segment if any points remain
    if (currentSegmentPoints.length >= 2) {
      const segStart = currentSegmentPoints[0].x;
      const segEnd = currentSegmentPoints[currentSegmentPoints.length - 1].x;
      const segRange = segEnd - segStart;
      
      const colorStops = currentSegmentPoints.map(p => ({
        offset: segRange > 0 ? `${((p.x - segStart) / segRange) * 100}%` : "0%",
        color: getLoadColor(p.load || 0),
      }));

      continuousSegments.push({
        points: [...currentSegmentPoints],
        colorStops,
      });
    }

    // Merge adjacent gaps when activity between them is shorter than adaptive threshold
    const MERGE_PERCENT = 0.02;
    const MIN_MERGE_MS = 3 * 60 * 1000;
    const MAX_MERGE_MS = 15 * 60 * 1000;
    const domainSpanMs = xDomainEnd - xDomainStart;
    const mergeThresholdMs = Math.max(
      MIN_MERGE_MS,
      Math.min(MAX_MERGE_MS, domainSpanMs * MERGE_PERCENT)
    );

    const mergedGaps: GapSegment[] = [];
    for (const gap of gaps) {
      const last = mergedGaps[mergedGaps.length - 1];
      if (last && gap.x1 - last.x2 <= mergeThresholdMs) {
        last.x2 = gap.x2;
        last.y2 = gap.y2;
        last.focus2 = gap.focus2;
        last.strain2 = gap.strain2;
        last.energy2 = gap.energy2;
      } else {
        mergedGaps.push({ ...gap });
      }
    }

    // Build stitched data for tooltip interaction
    const stitched: ChartPoint[] = [];
    for (let i = 0; i < points.length; i++) {
      const current = points[i];
      stitched.push(current);

      const next = points[i + 1];
      if (!next) continue;

      const delta = next.x - current.x;
      if (delta > GAP_THRESHOLD_MS && current.load != null && next.load != null) {
        stitched.push({
          x: current.x + 1,
          timestamp: new Date(current.x + 1).toISOString(),
          load: null,
          focus: null,
          strain: null,
          energy: null,
        });
      }
    }

    return {
      chartData: stitched,
      gapSegments: gaps,
      gapSegmentsForBreakBars: mergedGaps,
      xTicks,
      xDomainStart,
      xDomainEnd,
      continuousSegments,
    };
  }, [data]);

  const chartHeader = useMemo(
    () => (
      <div className={`flex justify-between items-center ${sessions.length > 0 ? "mb-3" : "mb-6"}`}>
        <h2 className="font-now text-xl font-medium text-foreground">
          Your daily mental performance
        </h2>
        <DateRangePicker
          firstDate={firstDate}
          isLoading={isLoading}
          value={selectedDate}
          onChange={onDateChange}
        />
      </div>
    ),
    [firstDate, isLoading, selectedDate, onDateChange, sessions.length],
  );

  if (isLoading) {
    return (
      <Card className="p-4 bg-content1 border border-white/10 hover:border-white/15 transition-colors">
        <CardBody className="pt-4">
          {chartHeader}
          <div className="flex items-center justify-center h-64">
            <Spinner size="lg" label="Loading dashboard data..." />
          </div>
        </CardBody>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-4 bg-content1 border border-white/10 hover:border-white/15 transition-colors">
        <CardBody className="pt-4">
          {chartHeader}
          <div className="h-64 flex items-center justify-center">
            <div className="text-center space-y-4 max-w-md mx-auto">
              <div className={`inline-block ${isToday ? "animate-pulse" : ""}`}>
                <svg
                  className="w-16 h-16 mx-auto text-foreground/30"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No Data Available
                </h3>
                <p className="text-sm text-foreground/60">
                  {isToday
                    ? "There's no cognitive load data for today, yet."
                    : "There's no cognitive load data recorded for the selected date."}
                </p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-content1 border border-white/10 hover:border-white/15 transition-colors">
      <CardBody className="pt-4">
        {chartHeader}
        {/* SessionBars chartLeftMargin/Right must match chart Y-axis width (45) and margin.right (28) */}
        {sessions.length > 0 && xDomainStart > 0 && xDomainEnd > xDomainStart && (
          <SessionBars
            sessions={sessions}
            xDomainStart={xDomainStart}
            xDomainEnd={xDomainEnd}
            chartLeftMargin={45}
            chartRightMargin={28}
          />
        )}
        <div className="h-64">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full">
                <Spinner size="lg" label="Loading chart..." />
              </div>
            }
          >
            {chartView === "total" ? (
              <LazyChart
                data={chartData}
                gapSegments={gapSegments}
                gapSegmentsForBreakBars={gapSegmentsForBreakBars}
                xTicks={xTicks}
                xDomainStart={xDomainStart}
                xDomainEnd={xDomainEnd}
                continuousSegments={continuousSegments}
                uniqueId={uniqueId}
              />
            ) : (
              <LazySubmetricsChart
                data={chartData}
                gapSegments={gapSegments}
                gapSegmentsForBreakBars={gapSegmentsForBreakBars}
                xTicks={xTicks}
                xDomainStart={xDomainStart}
                xDomainEnd={xDomainEnd}
              />
            )}
          </Suspense>
        </div>
        <div className="flex justify-between items-center mt-1.5">
          <Button
            size="sm"
            variant="bordered"
            onPress={() => setChartView(chartView === "total" ? "submetrics" : "total")}
            className="btn-plain min-w-0 px-2.5 py-1 h-7 text-xs text-foreground/60 hover:text-foreground border-white/10 hover:border-white/15"
          >
            {chartView === "total" ? "Total score" : "Submetrics"}
          </Button>
          <div className="flex items-center gap-3">
            {chartView === "total" ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#5C78FD" }}></span>
                  <span className="text-xs text-foreground/50">Low</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#A07CEF" }}></span>
                  <span className="text-xs text-foreground/50">Medium</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#FF709B" }}></span>
                  <span className="text-xs text-foreground/50">High</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#5C78FD" }}></span>
                  <span className="text-xs text-foreground/50">Focus</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#A07CEF" }}></span>
                  <span className="text-xs text-foreground/50">Frustration</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#FF709B" }}></span>
                  <span className="text-xs text-foreground/50">Workload</span>
                </div>
              </>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

export default CognitiveLoadChart;
