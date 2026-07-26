import { useTranslation } from 'react-i18next';
import { Check, Sparkles } from 'lucide-react';
import { Button } from '@/design-system/button';
import { formatAmount } from '@/lib/format';
import type { MatchCandidate } from '@/lib/api/banking';

interface SuggestionRowProps {
  candidate: MatchCandidate;
  onAccept: () => void;
  isPending: boolean;
}

/**
 * Une suggestion de rapprochement.
 *
 * Elle n'apparaît que si le matcher a refusé de lier tout seul — écart de
 * montant, ou deux candidats trop proches. On montre donc l'écart et le décalage
 * de date : c'est exactement ce qui permet à l'utilisateur de trancher.
 */
export default function SuggestionRow({ candidate, onAccept, isPending }: SuggestionRowProps) {
  const { t } = useTranslation();
  const expense = candidate.interaction;
  const delta = Number(candidate.amount_delta);

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          {expense?.subject ?? t('banking.reconcile.unknownExpense')}
        </p>

        <p className="mt-0.5 text-xs text-muted-foreground">
          {expense?.amount ? formatAmount(expense.amount) : null}
          {delta > 0 ? ` · ${t('banking.reconcile.amountGap', {
            amount: formatAmount(candidate.amount_delta),
          })}` : ''}
          {candidate.day_gap !== 0
            ? ` · ${t('banking.reconcile.dayGap', { count: Math.abs(candidate.day_gap) })}`
            : ''}
        </p>
      </div>

      <Button type="button" size="sm" variant="outline" onClick={onAccept} disabled={isPending}>
        <Check className="mr-1 h-3.5 w-3.5" aria-hidden />
        {t('banking.reconcile.accept')}
      </Button>
    </div>
  );
}
