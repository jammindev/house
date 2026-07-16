import { useTranslation } from 'react-i18next';
import type { EggStatsPoint } from '@/lib/api/chickens';

interface EggChartProps {
  series: EggStatsPoint[];
  height?: number;
  className?: string;
}

/**
 * Laying curve — dependency-free SVG. The module's pivot made visible:
 * - a **logged** day (incl. count 0) is a dot; consecutive logged days are lined;
 * - a **gap** (count === null, day never logged) breaks the line — never a zero;
 * - a real **0** sits as a dot on the baseline (a visible dip, distinct from a gap);
 * - a **coverage strip** underneath shows one cell per day (filled = logged),
 *   so missing days are readable at a glance.
 */
export default function EggChart({ series, height = 96, className }: EggChartProps) {
  const { t } = useTranslation();
  const width = 320;
  const stripH = 10;
  const gap = 6;
  const pad = 4;
  const chartH = height - stripH - gap;

  const n = series.length;
  if (n === 0) return null;

  const maxCount = Math.max(1, ...series.map((p) => p.count ?? 0));
  const x = (i: number) => (n === 1 ? width / 2 : pad + (i * (width - 2 * pad)) / (n - 1));
  const y = (v: number) => pad + (chartH - 2 * pad) * (1 - v / maxCount);

  // Split into segments of consecutive logged days so gaps break the line.
  const segments: { i: number; v: number }[][] = [];
  let current: { i: number; v: number }[] = [];
  series.forEach((point, i) => {
    if (point.count == null) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push({ i, v: point.count });
    }
  });
  if (current.length) segments.push(current);

  const dots = segments.flat();

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={t('chickens.eggs.chart_aria')}
      preserveAspectRatio="none"
    >
      {/* baseline */}
      <line
        x1={pad}
        y1={y(0)}
        x2={width - pad}
        y2={y(0)}
        className="stroke-border"
        strokeWidth={1}
      />
      {/* lines between consecutive logged days */}
      {segments.map((seg, si) =>
        seg.length >= 2 ? (
          <polyline
            key={`seg-${si}`}
            fill="none"
            className="stroke-primary"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={seg.map((d) => `${x(d.i)},${y(d.v)}`).join(' ')}
          />
        ) : null,
      )}
      {/* dots on every logged day (a real 0 lands on the baseline) */}
      {dots.map((d) => (
        <circle key={`dot-${d.i}`} cx={x(d.i)} cy={y(d.v)} r={2.5} className="fill-primary" />
      ))}
      {/* coverage strip: one cell per day, filled = logged */}
      {series.map((point, i) => {
        const cellW = (width - 2 * pad) / n;
        return (
          <rect
            key={`cov-${i}`}
            x={pad + i * cellW + 0.5}
            y={height - stripH}
            width={Math.max(1, cellW - 1)}
            height={stripH}
            rx={1}
            className={point.count == null ? 'fill-muted' : 'fill-primary/60'}
          />
        );
      })}
    </svg>
  );
}
