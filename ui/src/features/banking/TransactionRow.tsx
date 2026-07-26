import { useTranslation } from 'react-i18next';
import { Repeat, StickyNote } from 'lucide-react';
import { Card } from '@/design-system/card';
import CardActions, { type CardAction } from '@/components/CardActions';
import { formatAmount } from '@/lib/format';
import type { BankTransaction } from '@/lib/api/banking';

interface TransactionRowProps {
  transaction: BankTransaction;
  onToggleInternal: () => void;
  onEditNote: () => void;
}

export default function TransactionRow({
  transaction,
  onToggleInternal,
  onEditNote,
}: TransactionRowProps) {
  const { t } = useTranslation();
  const isOut = transaction.direction === 'out';

  const actions: CardAction[] = [
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
              <Repeat className="h-3 w-3" aria-hidden />
              {t('banking.journal.internal')}
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
