interface SparklinePoint {
  /** ISO timestamp — x is proportional to time (irregular readings stay honest). */
  t: string;
  v: number;
}

interface SparklineProps {
  points: SparklinePoint[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  showLastDot?: boolean;
  className?: string;
}

/**
 * Tiny dependency-free SVG sparkline. Stroke follows `currentColor`, so the
 * parent's text color drives the line color.
 */
export default function Sparkline({
  points,
  width = 120,
  height = 36,
  strokeWidth = 1.5,
  showLastDot = true,
  className,
}: SparklineProps) {
  if (points.length === 0) return null;

  const pad = strokeWidth + 2;
  const times = points.map((p) => new Date(p.t).getTime());
  const values = points.map((p) => p.v);
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const vMin = Math.min(...values);
  const vMax = Math.max(...values);
  const tSpan = tMax - tMin || 1;
  const vSpan = vMax - vMin || 1;

  const coords = points.map((p, i) => {
    const x = pad + ((times[i] - tMin) / tSpan) * (width - 2 * pad);
    const y = height - pad - ((p.v - vMin) / vSpan) * (height - 2 * pad);
    return [x, y] as const;
  });
  const last = coords[coords.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      {coords.length > 1 ? (
        <polyline
          points={coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {showLastDot ? (
        <circle cx={last[0]} cy={last[1]} r={strokeWidth + 1} fill="currentColor" />
      ) : null}
    </svg>
  );
}
