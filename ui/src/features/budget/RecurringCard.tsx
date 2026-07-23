import { useTranslation } from 'react-i18next';
import { Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { Card } from '@/design-system/card';
import { Button } from '@/design-system/button';
import CardActions, { type CardAction } from '@/components/CardActions';
import { formatDate } from '@/lib/format';
import type { RecurringExpense } from '@/lib/api/budget';
import { formatAmount } from './format';

interface Props {
  recurring: RecurringExpense;
  isDue: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onConfirm: () => void;
}

export default function RecurringCard({ recurring, isDue, onEdit, onDelete, onConfirm }: Props) {
  const { t } = useTranslation();

  const actions: CardAction[] = [
    { label: t('common.edit'), icon: Pencil, onClick: onEdit },
    { label: t('common.delete'), icon: Trash2, onClick: onDelete, variant: 'danger' },
  ];

  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-medium text-foreground">{recurring.label}</span>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
              {formatAmount(recurring.amount)}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t(`recurring.cadence.${recurring.cadence}`)}
            {' · '}
            <span className={isDue ? 'font-medium text-amber-600' : undefined}>
              {isDue
                ? t('recurring.dueOn', { date: formatDate(recurring.next_due_date) })
                : t('recurring.nextOn', { date: formatDate(recurring.next_due_date) })}
            </span>
            {recurring.budget ? ` · ${recurring.budget.name}` : ''}
          </p>

          {isDue ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2 gap-1.5"
              onClick={onConfirm}
            >
              <CheckCircle2 className="h-4 w-4" />
              {t('recurring.confirm.action')}
            </Button>
          ) : null}
        </div>

        <CardActions actions={actions} />
      </div>
    </Card>
  );
}
