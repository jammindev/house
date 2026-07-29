import { useTranslation } from 'react-i18next';
import { Pencil, Trash2 } from 'lucide-react';
import CardActions, { type CardAction } from '@/components/CardActions';
import { formatAmount } from '@/lib/format';
import type { BudgetCategoryRow, BudgetState } from '@/lib/api/budget';

const BAR_CLASS: Record<BudgetState, string> = {
  uncapped: 'bg-muted-foreground/30',
  ok: 'bg-primary',
  warning: 'bg-warning',
  over: 'bg-destructive',
};

const TEXT_CLASS: Record<BudgetState, string> = {
  uncapped: 'text-muted-foreground',
  ok: 'text-muted-foreground',
  warning: 'text-warning',
  over: 'text-destructive',
};

interface BudgetCategoryCardProps {
  row: BudgetCategoryRow;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * L'en-tête d'une catégorie : son nom et **son total**.
 *
 * Tous les chiffres viennent du serveur. Ne jamais les resommer ici depuis les
 * budgets affichés : le total et le panneau se mettraient à répondre chacun le
 * sien à « combien a-t-on dépensé ? », et deux compteurs qui se contredisent
 * dans le même écran se décrédibilisent l'un l'autre.
 *
 * Pas de `Link` : une catégorie ne porte aucune dépense, donc il n'y a pas de
 * page « de quoi ce compteur est-il fait » à ouvrir — ce sont les budgets
 * en dessous qui mènent quelque part.
 */
export default function BudgetCategoryCard({ row, onEdit, onDelete }: BudgetCategoryCardProps) {
  const { t } = useTranslation();
  // Pas de plafond → pas de barre ni de pourcentage : rien à mesurer. Une barre
  // verte à 0 % sur ce qui n'a pas d'échelle est le même mensonge qu'une coche
  // verte sur un contrôle qui n'a rien vérifié.
  const uncapped = row.amount === null;
  const pct = Math.min(100, Math.round(row.ratio * 100));
  const overBy = Number(row.net_spent) - Number(row.amount ?? 0);

  const actions: CardAction[] = [
    { label: t('common.edit'), icon: Pencil, onClick: onEdit },
    { label: t('common.delete'), icon: Trash2, onClick: onDelete, variant: 'danger' },
  ];

  return (
    <div className="flex items-start justify-between gap-2 px-1">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-foreground">{row.name}</h3>
          <span className={`shrink-0 text-sm tabular-nums ${TEXT_CLASS[row.state]}`}>
            {uncapped
              ? formatAmount(row.net_spent)
              : `${formatAmount(row.net_spent)} / ${formatAmount(row.amount as string)}`}
          </span>
        </div>

        {uncapped ? null : (
          <div
            className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`h-full transition-all ${BAR_CLASS[row.state]}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}

        <p className="mt-1 text-xs text-muted-foreground">
          {row.state === 'over'
            ? t('budget.overBy', { amount: formatAmount(String(overBy)) })
            : t('budget.category.holds', { count: row.budget_count })}
          {/* D'où vient le plafond affiché. Sans ça, « / 450 € » sur une
              catégorie qui n'a pas de plafond propre laisse croire qu'un
              chiffre a été saisi quelque part. */}
          {!uncapped && !row.has_own_amount ? ` · ${t('budget.category.sumHint')}` : ''}
        </p>
      </div>

      <CardActions actions={actions} />
    </div>
  );
}
