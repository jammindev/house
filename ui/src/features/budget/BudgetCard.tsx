import { useTranslation } from 'react-i18next';
import { Pencil, Trash2 } from 'lucide-react';
import { Card } from '@/design-system/card';
import CardActions, { type CardAction } from '@/components/CardActions';
import type { BudgetOverviewRow, BudgetState } from '@/lib/api/budget';
import { formatAmount } from './format';

const BAR_CLASS: Record<BudgetState, string> = {
  ok: 'bg-primary',
  warning: 'bg-amber-500',
  over: 'bg-destructive',
};

const TEXT_CLASS: Record<BudgetState, string> = {
  ok: 'text-muted-foreground',
  warning: 'text-amber-600',
  over: 'text-destructive',
};

interface BudgetCardProps {
  row: BudgetOverviewRow;
  onEdit: () => void;
  onDelete: () => void;
}

export default function BudgetCard({ row, onEdit, onDelete }: BudgetCardProps) {
  const { t } = useTranslation();
  const pct = Math.min(100, Math.round(row.ratio * 100));
  const overBy = Number(row.spent) - Number(row.amount);

  const actions: CardAction[] = [
    { label: t('common.edit'), icon: Pencil, onClick: onEdit },
    { label: t('common.delete'), icon: Trash2, onClick: onDelete, variant: 'danger' },
  ];

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-medium text-foreground">{row.name}</span>
            <span className={`shrink-0 text-sm tabular-nums ${TEXT_CLASS[row.state]}`}>
              {formatAmount(row.spent)} / {formatAmount(row.amount)}
            </span>
          </div>

          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${BAR_CLASS[row.state]}`}
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>

          <p className={`mt-1 text-xs ${TEXT_CLASS[row.state]}`}>
            {row.state === 'over'
              ? t('budget.overBy', { amount: formatAmount(String(overBy)) })
              : t('budget.percentUsed', { pct })}
          </p>
          {Number(row.committed) > 0 ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('budget.committed', { amount: formatAmount(row.committed) })}
            </p>
          ) : null}
        </div>

        <CardActions actions={actions} />
      </div>
    </Card>
  );
}
