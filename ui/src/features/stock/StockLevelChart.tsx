import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { ConsumptionChartOverlay } from '@/components/charts/ConsumptionBarChart';
import { formatLabel, formatTick } from '@/components/charts/ticks';
import type { StockConsumptionPoint, StockLevelPoint } from '@/lib/api/stock';

import { buildCurveRows, buildProjection, dayKey } from './levelCurve';

/**
 * Ce qu'il reste d'un article dans le temps — la courbe de niveau (#622).
 *
 * Remplace les barres quotidiennes de #575, qui affichaient N fois un seul
 * fait : entre deux comptages, la « consommation du mardi » n'était pas une
 * mesure mais une division. Un relevé dit *combien il reste*, jamais *quand ça
 * a été consommé.
 *
 * Trois partis pris, tous du métier :
 *
 * 1. **Une droite, pas une marche.** Contrairement à `BalanceLineChart` — un
 *    solde tient jusqu'à ce que quelque chose le bouge — un stock se vide en
 *    continu. Interpoler *est* ici la lecture honnête, et c'est exactement ce
 *    qu'affirme le « rythme de consommation » affiché juste au-dessus.
 * 2. **Les relevés sont marqués, le reste ne l'est pas.** Un point sur chaque
 *    comptage : ce sont les seuls faits. Le trait entre deux points est une
 *    estimation, et se lit comme telle.
 * 3. **Le pointillé commence où la mesure s'arrête.** Après le dernier relevé
 *    personne n'a compté ; la projection vers zéro rend visible la date de
 *    rupture, qui n'était jusqu'ici qu'un nombre dans sa tuile.
 */

interface StockLevelChartProps {
  levels: StockLevelPoint[];
  /** Les relevés de la fenêtre — les seuls points marqués de la courbe. */
  readings: StockConsumptionPoint[];
  depletionDate: string | null;
  /** Jusqu'où le pointillé a le droit d'aller, en jours (la fenêtre affichée). */
  horizonDays: number;
  unit: string;
  /** Température sur l'axe de droite, quand la cadence des relevés le permet. */
  overlay?: ConsumptionChartOverlay;
}

const LEVEL_COLOR = 'hsl(var(--chart-1))';

export default function StockLevelChart({
  levels,
  readings,
  depletionDate,
  horizonDays,
  unit,
  overlay,
}: StockLevelChartProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  const last = levels[levels.length - 1];

  const projection = React.useMemo(
    () =>
      last
        ? buildProjection({
            lastTs: last.ts,
            lastQuantity: last.quantity,
            depletionDate,
            horizonDays,
          })
        : [],
    [last, depletionDate, horizonDays],
  );

  const data = React.useMemo(() => {
    const overlayByTs = new Map((overlay?.points ?? []).map((p) => [dayKey(p.ts), p.value]));
    return buildCurveRows(levels, projection).map((row) => ({
      ...row,
      ...(overlay ? { [overlay.key]: overlayByTs.get(row.ts) ?? null } : {}),
    }));
  }, [levels, projection, overlay]);

  // Les jours qui portent un vrai comptage — eux seuls reçoivent un point.
  const readingDays = React.useMemo(
    () => new Set(readings.map((reading) => dayKey(reading.date))),
    [readings],
  );

  const crossesMonths = React.useMemo(
    () => new Set(data.map((row) => row.ts.slice(0, 7))).size > 1,
    [data],
  );

  const seriesLabel = React.useCallback(
    (key: string) => {
      if (overlay && key === overlay.key) return overlay.label;
      if (key === 'projection') return t('stock.consumption.projection');
      return t('stock.consumption.level');
    },
    [overlay, t],
  );

  const renderReadingDot = React.useCallback(
    (props: { cx?: number; cy?: number; payload?: { ts?: string } }) => {
      const { cx, cy, payload } = props;
      const key = `${payload?.ts ?? ''}-${cx}`;
      if (cx == null || cy == null || !payload?.ts || !readingDays.has(payload.ts)) {
        return <g key={key} />;
      }
      return (
        <circle
          key={key}
          cx={cx}
          cy={cy}
          r={4}
          fill={LEVEL_COLOR}
          stroke="hsl(var(--card))"
          strokeWidth={2}
        />
      );
    },
    [readingDays],
  );

  return (
    <div className="h-64 w-full sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="ts"
            tickFormatter={(ts: string) => formatTick(ts, 'day', locale, crossesMonths)}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          {/* Ancré à zéro : sur un niveau, zéro *est* l'événement qu'on surveille. */}
          <YAxis
            yAxisId="main"
            domain={[0, 'auto']}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            width={56}
            unit={` ${unit}`}
          />
          {overlay && (
            <YAxis
              yAxisId="overlay"
              orientation="right"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              width={40}
              unit={` ${overlay.unit}`}
            />
          )}
          <Tooltip
            cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(ts) => formatLabel(String(ts), 'day', locale)}
            formatter={(value, name) => {
              const isOverlay = Boolean(overlay && name === overlay.key);
              const suffix = isOverlay && overlay ? overlay.unit : unit;
              return [`${String(value)} ${suffix}`, seriesLabel(String(name))];
            }}
          />
          {(projection.length > 0 || overlay) && (
            <Legend formatter={(value: string) => seriesLabel(value)} wrapperStyle={{ fontSize: 12 }} />
          )}
          <Line
            yAxisId="main"
            type="linear"
            dataKey="level"
            stroke={LEVEL_COLOR}
            strokeWidth={2}
            dot={renderReadingDot}
            activeDot={{ r: 5 }}
            connectNulls={false}
            isAnimationActive={false}
          />
          {projection.length > 0 && (
            <Line
              yAxisId="main"
              type="linear"
              dataKey="projection"
              stroke={LEVEL_COLOR}
              strokeWidth={2}
              strokeDasharray="4 4"
              strokeOpacity={0.55}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )}
          {overlay && (
            <Line
              yAxisId="overlay"
              type="monotone"
              dataKey={overlay.key}
              stroke={overlay.color}
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
