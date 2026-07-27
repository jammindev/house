import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatAmount } from '@/lib/format';
import { chartColor, UNBUDGETED_COLOR } from '@/lib/chartColors';
import type { AnalysisBreakdownRow } from '@/lib/api/budget';

/** Au-delà, les parts deviennent des filets illisibles — on les regroupe. */
const VISIBLE_SLICES = 6;

interface BudgetShareChartProps {
  rows: AnalysisBreakdownRow[];
  total: string;
}

/**
 * Où part l'argent sur la fenêtre — anneau + légende chiffrée.
 *
 * L'anneau seul ne se lit pas : sur mobile, six parts se ressemblent toutes.
 * La légende porte le montant **et** la part, et c'est elle qu'on lit en
 * pratique ; le disque donne l'ordre de grandeur d'un coup d'œil.
 *
 * Le trou du milieu affiche le total, parce que la première question devant une
 * répartition est toujours « de combien parle-t-on ».
 */
export default function BudgetShareChart({ rows, total }: BudgetShareChartProps) {
  const { t } = useTranslation();

  // Regroupement au-delà de six : « Autres » agrège la traîne plutôt que de
  // produire douze filets d'un pixel qu'aucune infobulle ne rattrape.
  const slices = React.useMemo(() => {
    const head = rows.slice(0, VISIBLE_SLICES);
    const tail = rows.slice(VISIBLE_SLICES);
    const out = head.map((row, index) => ({
      key: row.budget_id ?? 'unbudgeted',
      label: row.name ?? t('budget.unbudgeted.label'),
      value: Number(row.total),
      share: row.share,
      color: row.budget_id === null ? UNBUDGETED_COLOR : chartColor(index),
    }));
    if (tail.length > 0) {
      out.push({
        key: 'others',
        label: t('analysis.others', { count: tail.length }),
        value: tail.reduce((sum, row) => sum + Number(row.total), 0),
        share: tail.reduce((sum, row) => sum + row.share, 0),
        color: 'hsl(var(--muted))',
      });
    }
    return out;
  }, [rows, t]);

  if (slices.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative h-48 w-full shrink-0 sm:w-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={1}
              stroke="hsl(var(--card))"
              strokeWidth={2}
            >
              {slices.map((slice) => (
                <Cell key={slice.key} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value, name) => [formatAmount(Number(value)), String(name)]}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Centré sur l'anneau, non cliquable : c'est une étiquette, pas un contrôle. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">{t('analysis.periodTotal')}</span>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {formatAmount(total, { fractionDigits: 0 })}
          </span>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: slice.color }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-foreground">{slice.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {Math.round(slice.share * 100)}%
            </span>
            <span className="w-20 shrink-0 text-right tabular-nums text-foreground">
              {formatAmount(slice.value, { fractionDigits: 0 })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
