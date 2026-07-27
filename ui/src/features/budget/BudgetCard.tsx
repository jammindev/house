import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pencil, Trash2 } from 'lucide-react';
import { Card } from '@/design-system/card';
import CardActions, { type CardAction } from '@/components/CardActions';
import { formatAmount } from '@/lib/format';
import type { BudgetOverviewRow, BudgetState } from '@/lib/api/budget';

const BAR_CLASS: Record<BudgetState, string> = {
  uncapped: 'bg-muted-foreground/30',
  ok: 'bg-primary',
  warning: 'bg-amber-500',
  over: 'bg-destructive',
};

const TEXT_CLASS: Record<BudgetState, string> = {
  uncapped: 'text-muted-foreground',
  ok: 'text-muted-foreground',
  warning: 'text-amber-600',
  over: 'text-destructive',
};

interface BudgetCardProps {
  row: BudgetOverviewRow;
  onEdit: () => void;
  onDelete: () => void;
  /** Ouvre le détail — « de quoi ce compteur est-il fait ». */
  to: string;
  /** Pile de retour, pour que le détail sache d'où on vient. */
  backState?: unknown;
}

export default function BudgetCard({ row, onEdit, onDelete, to, backState }: BudgetCardProps) {
  const { t } = useTranslation();
  // Pas de plafond → pas de barre, pas de pourcentage, pas de dépassement :
  // il n'y a rien à mesurer. On dit juste ce que la catégorie a coûté.
  const uncapped = row.amount === null;
  const pct = Math.min(100, Math.round(row.ratio * 100));
  const overBy = Number(row.spent) - Number(row.amount ?? 0);

  const actions: CardAction[] = [
    { label: t('common.edit'), icon: Pencil, onClick: onEdit },
    { label: t('common.delete'), icon: Trash2, onClick: onDelete, variant: 'danger' },
  ];

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        {/* Le lien porte le corps de la carte, pas la carte entière : le
            dropdown d'actions est un enfant, et l'imbriquer dans un <a> en
            ferait un déclencheur de navigation au premier clic. */}
        <Link to={to} state={backState} className="group min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-medium text-foreground group-hover:underline">
              {row.name}
            </span>
            <span className={`shrink-0 text-sm tabular-nums ${TEXT_CLASS[row.state]}`}>
              {uncapped
                ? formatAmount(row.spent)
                : `${formatAmount(row.spent)} / ${formatAmount(row.amount as string)}`}
            </span>
          </div>

          {uncapped ? null : (
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
          )}

          <p className={`mt-1 text-xs ${TEXT_CLASS[row.state]}`}>
            {uncapped
              ? t('budget.uncapped.hint')
              : row.state === 'over'
                ? t('budget.overBy', { amount: formatAmount(String(overBy)) })
                : t('budget.percentUsed', { pct })}
          </p>
          {Number(row.committed) > 0 ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('budget.committed', { amount: formatAmount(row.committed) })}
            </p>
          ) : null}
        </Link>

        <CardActions actions={actions} />
      </div>
    </Card>
  );
}
