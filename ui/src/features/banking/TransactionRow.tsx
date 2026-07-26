import { useTranslation } from 'react-i18next';
import {
  Banknote,
  Link2Off,
  PieChart,
  Repeat,
  Sparkles,
  StickyNote,
  Tag,
} from 'lucide-react';
import { Card } from '@/design-system/card';
import CardActions, { type CardAction } from '@/components/CardActions';
import { formatAmount } from '@/lib/format';
import type { BankTransaction } from '@/lib/api/banking';

interface TransactionRowProps {
  transaction: BankTransaction;
  /** Y a-t-il un compte espèces où verser un retrait ? */
  canFeedCash: boolean;
  onToggleInternal: () => void;
  onEditNote: () => void;
  onFeedCash: () => void;
  onUnlinkCash: () => void;
  onAllocate: () => void;
  onSuggest: () => void;
  /** Classer une recette (salaire / remboursement / virement / autre). */
  onClassify: () => void;
}

export default function TransactionRow({
  transaction,
  canFeedCash,
  onToggleInternal,
  onEditNote,
  onFeedCash,
  onUnlinkCash,
  onAllocate,
  onSuggest,
  onClassify,
}: TransactionRowProps) {
  const { t } = useTranslation();
  const isOut = transaction.direction === 'out';
  const hasCounterpart = Boolean(transaction.transfer_counterpart);

  const actions: CardAction[] = [
    // Ventiler n'a de sens que sur une sortie réelle, jamais sur un
    // mouvement interne (son argent est compté quand le liquide est dépensé).
    ...(isOut && !hasCounterpart
      ? [{ label: t('banking.allocation.action'), icon: PieChart, onClick: onAllocate }]
      : []),
    ...(isOut && !hasCounterpart
      ? [{ label: t('banking.reconcile.action'), icon: Sparkles, onClick: onSuggest }]
      : []),
    // Verser aux espèces n'a de sens que sur une sortie encore libre.
    ...(isOut && !hasCounterpart && canFeedCash
      ? [{ label: t('banking.cash.action'), icon: Banknote, onClick: onFeedCash }]
      : []),
    ...(hasCounterpart
      ? [{ label: t('banking.cash.unlink'), icon: Link2Off, onClick: onUnlinkCash }]
      : []),
    // Classer n'a de sens que sur une recette : une sortie n'a pas de nature.
    ...(!isOut && !transaction.is_internal
      ? [{ label: t('banking.inflow.action'), icon: Tag, onClick: onClassify }]
      : []),
    {
      label: transaction.is_internal
        ? t('banking.journal.unmarkInternal')
        : t('banking.journal.markInternal'),
      icon: Repeat,
      onClick: onToggleInternal,
    },
    { label: t('banking.journal.editNote'), icon: StickyNote, onClick: onEditNote },
  ];

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            {/* Libellé brut de la banque — jamais réécrit. */}
            <span className="truncate text-sm font-medium text-foreground">
              {transaction.label_raw}
            </span>
            <span
              className={`shrink-0 text-sm font-semibold tabular-nums ${
                transaction.is_internal
                  ? 'text-muted-foreground'
                  : isOut
                    ? 'text-destructive'
                    : 'text-primary'
              }`}
            >
              {formatAmount(transaction.amount)}
            </span>
          </div>

          <p className="mt-0.5 text-xs text-muted-foreground">
            {new Date(transaction.booked_on).toLocaleDateString()}
            {transaction.balance_after
              ? ` · ${t('banking.journal.balanceAfter', {
                  amount: formatAmount(transaction.balance_after),
                })}`
              : ''}
          </p>

          {transaction.is_internal ? (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {hasCounterpart ? (
                <Banknote className="h-3 w-3" aria-hidden />
              ) : (
                <Repeat className="h-3 w-3" aria-hidden />
              )}
              {hasCounterpart ? t('banking.cash.linkedBadge') : t('banking.journal.internal')}
            </span>
          ) : null}

          {/* Une recette non classée est un écart : le dire ici, là où on peut la
              classer, plutôt que seulement dans le panneau Contrôle. */}
          {!isOut && !transaction.is_internal ? (
            <span
              className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                transaction.inflow_nature
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <Tag className="h-3 w-3" aria-hidden />
              {transaction.inflow_nature
                ? t(`banking.inflow.natures.${transaction.inflow_nature}`)
                : t('banking.inflow.unclassified')}
            </span>
          ) : null}

          {transaction.notes ? (
            <p className="mt-1 text-xs italic text-muted-foreground">{transaction.notes}</p>
          ) : null}
        </div>

        <CardActions actions={actions} />
      </div>
    </Card>
  );
}
