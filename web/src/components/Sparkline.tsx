import { useId } from 'react';

/**
 * Sparkline — A lightweight inline SVG mini-chart for trend visualization.
 * Renders a smooth area chart with optional gradient fill.
 * Used in InsightsPage hero stat cards for 7-day daily trends.
 */

interface SparklineProps {
  /** Array of numeric data points to plot */
  data: number[];
  /** SVG width in pixels */
  width?: number;
  /** SVG height in pixels */
  height?: number;
  /** Stroke color for the line */
  color?: string;
  /** Fill color for the area under the line (with opacity) */
  fillColor?: string;
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Whether to show the area fill under the line */
  showArea?: boolean;
  /** Additional CSS class names */
  className?: string;
}

export function Sparkline({
  data,
  width = 80,
  height = 28,
  color = '#10B981',
  fillColor,
  strokeWidth = 1.5,
  showArea = true,
  className = '',
}: SparklineProps) {
  const gradientId = `sparkline-gradient-${useId()}`;

  if (!data || data.length < 2) {
    return null;
  }

  const padding = 2;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // Avoid division by zero

  // Map data points to SVG coordinates
  const points = data.map((value, index) => ({
    x: padding + (index / (data.length - 1)) * chartWidth,
    y: padding + chartHeight - ((value - min) / range) * chartHeight,
  }));

  // Build the polyline path
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Build the area path (line + close to bottom)
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${(height - padding).toFixed(1)} L${padding.toFixed(1)},${(height - padding).toFixed(1)} Z`;

  const resolvedFillColor = fillColor || color;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`inline-block ${className}`}
      aria-hidden="true"
    >
      {showArea && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={resolvedFillColor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={resolvedFillColor} stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <path
            d={areaPath}
            fill={`url(#${gradientId})`}
          />
        </>
      )}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dot on the last data point */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={2}
        fill={color}
      />
    </svg>
  );
}