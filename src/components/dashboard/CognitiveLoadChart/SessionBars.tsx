import React, { useMemo, useState } from "react";
import {
  IconMessage,
  IconUsers,
  IconFileText,
  IconChecklist,
  IconSearch,
  IconCode,
  IconPalette,
  IconChartBar,
  IconVideo,
  IconDots,
} from "@tabler/icons-react";
import { Card } from "@heroui/card";

interface SessionData {
  id: string;
  timestamp_start: string;
  timestamp_end: string;
  length: number;
  score_total: number | null;
  category_share: Record<string, number>;
  pomodoro?: boolean;
  // Actual activity timestamps from behavioral_metrics_log
  // Use these for rendering to show actual work periods, not session creation times
  activity_start: string | null;
  activity_end: string | null;
}

interface SessionBarsProps {
  sessions: SessionData[];
  xDomainStart: number;
  xDomainEnd: number;
  chartLeftMargin?: number;
  chartRightMargin?: number;
}

// Icon size for session bars (smaller than ProductivityTimeCard)
const ICON_SIZE = 14;
const ICON_CONTAINER_SIZE = 24; // p-1.5 + icon size
const ICON_OVERLAP = 8; // Overlap amount in pixels
const LINE_HEIGHT = 4; // 1px thinner than the 5px break lines
const MIN_WIDTH_FOR_ICONS = 28; // Minimum session width to show 1 icon
const MIN_WIDTH_PER_ADDITIONAL_ICON = 18; // Additional width needed per extra icon
// Assume ~800px chart width for %→px; bars narrower than this don't show (no icon fits)
const ESTIMATED_CHART_WIDTH = 800;
const MIN_WIDTH_PERCENT_FOR_BAR = (MIN_WIDTH_FOR_ICONS / ESTIMATED_CHART_WIDTH) * 100;

// Color interpolation helpers (matching chart colors)
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
  color2: string
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
  if (load <= 30) return "#5C78FD"; // Blue
  if (load <= 65) return interpolateColor(load, 30, 65, "#5C78FD", "#A07CEF");
  return "#FF709B"; // Pink
};

// Category icon mapping
const getCategoryIcon = (category: string, size: number = ICON_SIZE) => {
  switch (category) {
    case "Communication":
      return <IconMessage width={size} height={size} />;
    case "Meetings":
      return <IconUsers width={size} height={size} />;
    case "Docs and Writing":
      return <IconFileText width={size} height={size} />;
    case "Productivity and Planning":
      return <IconChecklist width={size} height={size} />;
    case "Browsing and Research":
      return <IconSearch width={size} height={size} />;
    case "Development":
      return <IconCode width={size} height={size} />;
    case "Design and Creative":
      return <IconPalette width={size} height={size} />;
    case "Data and Analytics":
      return <IconChartBar width={size} height={size} />;
    case "Media and Entertainment":
      return <IconVideo width={size} height={size} />;
    case "Other":
      return <IconDots width={size} height={size} />;
    default:
      return <IconDots width={size} height={size} />;
  }
};

// Get top categories sorted by percentage
const getTopCategories = (
  categoryShare: Record<string, number>,
  maxCount: number
): string[] => {
  return Object.entries(categoryShare)
    .filter(([, percentage]) => percentage > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCount)
    .map(([category]) => category);
};

// Calculate how many icons can fit in the session width
const getIconCount = (sessionWidthPx: number): number => {
  if (sessionWidthPx < MIN_WIDTH_FOR_ICONS) return 0;
  const additionalIcons = Math.floor(
    (sessionWidthPx - MIN_WIDTH_FOR_ICONS) / MIN_WIDTH_PER_ADDITIONAL_ICON
  );
  return Math.min(1 + additionalIcons, 3);
};

// Category icon component with overlapping effect
const CategoryIconOverlap = ({
  category,
  isFirst,
  isLast,
  zIndex,
}: {
  category: string;
  isFirst: boolean;
  isLast: boolean;
  zIndex: number;
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative shrink-0"
      style={{
        marginRight: isLast ? 0 : -ICON_OVERLAP,
        zIndex,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className="rounded-md p-1 relative cursor-pointer"
        style={{
          backgroundColor: "#38333E",
          // Inner shadow matches card (#221D28), slightly more opaque and a bit longer
          boxShadow: isFirst
            ? "none"
            : "inset 10px 0 20px -4px rgba(34,29,40,0.95)",
        }}
      >
        <div className="text-foreground/80">{getCategoryIcon(category)}</div>
      </div>
      {/* Tooltip */}
      {isHovered && (
        <div
          className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 pointer-events-none"
          style={{ zIndex: 1000 }}
        >
          <Card isBlurred shadow="lg" className="px-3 py-2">
            <p className="text-xs font-semibold text-foreground whitespace-nowrap">
              {category}
            </p>
          </Card>
        </div>
      )}
    </div>
  );
};

const SessionBars: React.FC<SessionBarsProps> = ({
  sessions,
  xDomainStart,
  xDomainEnd,
  chartLeftMargin = 35, // Approximate Y-axis label width
  chartRightMargin = 30,
}) => {
  // Parse timestamp to milliseconds
  const parseTimestampMs = (timestamp: string): number | null => {
    const direct = Date.parse(timestamp);
    if (!Number.isNaN(direct)) return direct;

    // Fallback for space-separated timestamps
    if (timestamp.includes(" ") && !timestamp.includes("T")) {
      const normalized = `${timestamp.replace(" ", "T")}Z`;
      const parsed = Date.parse(normalized);
      if (!Number.isNaN(parsed)) return parsed;
    }

    return null;
  };

  // Calculate session positions and widths
  const sessionBars = useMemo(() => {
    if (!sessions || sessions.length === 0) return [];

    const domainWidth = xDomainEnd - xDomainStart;
    if (domainWidth <= 0) return [];

    const result = sessions
      .map((session) => {
        // Prefer activity timestamps (actual work period) over session timestamps
        // Activity timestamps represent when user actually worked, not when session was created/ended
        const startTimestamp = session.activity_start || session.timestamp_start;
        const endTimestamp = session.activity_end || session.timestamp_end;
        
        const startMs = parseTimestampMs(startTimestamp);
        const endMs = parseTimestampMs(endTimestamp);

        if (startMs === null || endMs === null) return null;

        // Calculate position as percentage of domain
        const leftPercent = ((startMs - xDomainStart) / domainWidth) * 100;
        const widthPercent = ((endMs - startMs) / domainWidth) * 100;

        // Clamp to valid range
        const clampedLeft = Math.max(0, Math.min(100, leftPercent));
        const clampedWidth = Math.max(
          0,
          Math.min(100 - clampedLeft, widthPercent)
        );

        // Skip sessions that are completely outside the domain
        if (clampedWidth <= 0) return null;
        // Skip very short bars where no icon would fit
        if (clampedWidth < MIN_WIDTH_PERCENT_FOR_BAR) return null;

        const color = getLoadColor(session.score_total ?? 50);
        const topCategories = getTopCategories(session.category_share, 3);
        const isPomodoro = session.pomodoro === true;

        return {
          id: session.id,
          leftPercent: clampedLeft,
          widthPercent: clampedWidth,
          color,
          categories: topCategories,
          isPomodoro,
        };
      })
      .filter(
        (bar): bar is NonNullable<typeof bar> => bar !== null && bar.widthPercent > 0.5
      );

    return result;
  }, [sessions, xDomainStart, xDomainEnd]);

  if (sessionBars.length === 0) {
    return null;
  }

  return (
    <div
      className="relative w-full mb-1"
      style={{
        height: ICON_CONTAINER_SIZE + LINE_HEIGHT + 2, // Icons + line + minimal gap
        paddingLeft: chartLeftMargin,
        paddingRight: chartRightMargin,
        marginTop: -4, // Reduce space above by pulling it closer to header
      }}
    >
      {/* Session bars container - positioned within the padded area */}
      <div className="relative w-full h-full">
        {sessionBars.map((bar) => (
          <div
            key={bar.id}
            className="absolute bottom-0"
            style={{
              left: `${bar.leftPercent}%`,
              width: `${bar.widthPercent}%`,
            }}
          >
            {/* Category icons */}
            <SessionIcons
              categories={bar.categories}
              widthPercent={bar.widthPercent}
            />

            {/* Session line */}
            <div
              className="w-full rounded-full mt-1"
              style={{
                height: LINE_HEIGHT,
                ...(bar.isPomodoro
                  ? {
                      background:
                        "linear-gradient(90deg, #A07CEF 0%, #A07CEF 60%, #FF709B 100%)",
                      boxShadow:
                        "0 0 8px rgba(160,124,239,0.4), 0 0 16px rgba(255,112,155,0.2)",
                    }
                  : { backgroundColor: bar.color }),
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// Separate component for icons to handle width calculation
const SessionIcons: React.FC<{
  categories: string[];
  widthPercent: number;
}> = ({ categories, widthPercent }) => {
  // Estimate width in pixels (rough calculation based on typical container width)
  // This will be refined when the component mounts
  const estimatedWidthPx = (widthPercent / 100) * 800; // Assume ~800px chart width
  const iconCount = getIconCount(estimatedWidthPx);

  if (iconCount === 0 || categories.length === 0) {
    return null;
  }

  const displayCategories = categories.slice(0, iconCount);

  return (
    <div className="flex items-center">
      {displayCategories.map((category, index) => (
        <CategoryIconOverlap
          key={category}
          category={category}
          isFirst={index === 0}
          isLast={index === displayCategories.length - 1}
          zIndex={displayCategories.length - index}
        />
      ))}
    </div>
  );
};

export default SessionBars;
