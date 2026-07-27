import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Split } from 'lucide-react';
import { Card } from '@/design-system/card';
import { Button } from '@/design-system/button';
import { CheckboxField } from '@/design-system/checkbox-field';
import { formatAmount } from '@/lib/format';
import { useSetAllocations } from '@/features/banking/hooks';
import type { PendingRow } from './PendingQueue';

interface PendingCardProps {
  row: PendingRow;
  budgets: { id: string; name: string }[];
  selected: boolean;
  /** Absent quand la ligne n'est pas sélectionnable (voir `PendingQueue`). */
  onToggleSelected?: () => void;
  onSplit: () => void;
  onPostpone: () => void;
  onWaive: () => void;
}

/**
 * Une opération à ranger, avec les quatre issues possibles — et **aucune
 * cinquième** qui consisterait à la faire disparaître sans rien enregistrer :
 *
 * - **une pastille de budget** : le cas courant, un clic, toute l'opération ;
 * - **« Ventiler en plusieurs »** : le découpage, qui reste central ;
 * - **« Arbitrer »** : un motif est exigé, et l'écart devient auditable ;
 * - **« Plus tard »** : la ligne quitte l'écran pour la session, sans rien écrire —
 *   elle sera là au prochain passage, parce qu'elle n'est pas résolue.
 *
 * Les pastilles n'apparaissent **que** sur une ligne entièrement non ventilée :
 * l'enregistrement d'une ventilation est un remplacement complet, donc imputer
 * d'un clic une ligne déjà partagée écraserait le travail déjà fait. Sur une ligne
 * partielle, le seul chemin est le dialog, qui part de l'existant.
 */
export default function PendingCard({
  row,
  budgets,
  selected,
  onToggleSelected,
  onSplit,
  onPostpone,
  onWaive,
}: PendingCardProps) {
  const { t } = useTranslation();
  const setAllocationsMutation = useSetAllocations();
  const [pending, setPending] = React.useState(false);

  async function assignWhole(budgetId: string) {
    setPending(true);
    try {
      await setAllocationsMutation.mutateAsync({
        transactionId: row.transactionId,
        lines: [{ subject: row.label, amount: row.outflow, budget_id: budgetId || null }],
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className={`p-3 ${selected ? 'border-primary/50 bg-primary/5' : ''}`}>
      <div className="flex items-start gap-2">
        {onToggleSelected ? (
          <div className="pt-0.5">
            <CheckboxField
              id={`pick-${row.transactionId}`}
              label=""
              checked={selected}
              onChange={onToggleSelected}
            />
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{row.label}</p>
              <p className="text-xs text-muted-foreground">
                {row.bookedOn ? new Date(row.bookedOn).toLocaleDateString() : ''}
                {row.accountName ? ` · ${row.accountName}` : ''}
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
              {formatAmount(row.outflow)}
            </span>
          </div>

          {row.isPartial ? (
            <p className="mt-1 text-xs text-warning">
              {t('money.pending.partial', {
                allocated: formatAmount(row.allocated),
                remaining: formatAmount(row.remaining),
              })}
            </p>
          ) : null}

          {row.isStale ? (
            <p className="mt-1 text-xs italic text-warning">
              {t('money.compliance.stale', { reason: row.waiverReason })}
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {!row.isPartial
              ? budgets.map((budget) => (
                  <Button
                    key={budget.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => assignWhole(budget.id)}
                  >
                    {budget.name}
                  </Button>
                ))
              : null}

            <Button type="button" variant="ghost" size="sm" onClick={onSplit} disabled={pending}>
              <Split className="mr-1 h-3.5 w-3.5" aria-hidden />
              {row.isPartial ? t('money.pending.complete') : t('money.pending.split')}
            </Button>

            <Button type="button" variant="ghost" size="sm" onClick={onWaive} disabled={pending}>
              {row.isStale
                ? t('money.compliance.rearbitrate')
                : t('money.compliance.arbitrate')}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onPostpone}
              disabled={pending}
              className="text-muted-foreground"
            >
              {t('money.pending.later')}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
