import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Button } from '@/design-system/button';
import { formatAmount } from '@/lib/format';
import type { BankTransaction } from '@/lib/api/banking';
import { useLinkInteraction, useSuggestions } from './hooks';
import SuggestionRow from './SuggestionRow';

interface SuggestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: BankTransaction;
}

/** Les dépenses déjà saisies qui pourraient correspondre à cette ligne. */
export default function SuggestionsDialog({
  open,
  onOpenChange,
  transaction,
}: SuggestionsDialogProps) {
  const { t } = useTranslation();
  const suggestionsQuery = useSuggestions(open ? transaction.id : undefined);
  const linkMutation = useLinkInteraction();

  const candidates = suggestionsQuery.data ?? [];

  return (
    <SheetDialog open={open} onOpenChange={onOpenChange} title={t('banking.reconcile.title')}>
      <div className="mt-4 space-y-4">
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <p className="font-medium text-foreground">{transaction.label_raw}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(transaction.booked_on).toLocaleDateString()} ·{' '}
            {formatAmount(transaction.amount)}
          </p>
        </div>

        {suggestionsQuery.isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('banking.reconcile.noSuggestion')}</p>
        ) : (
          <div className="space-y-2">
            {candidates.map((candidate) => (
              <SuggestionRow
                key={candidate.interaction_id}
                candidate={candidate}
                isPending={linkMutation.isPending}
                onAccept={() =>
                  linkMutation.mutate(
                    {
                      transactionId: transaction.id,
                      interactionId: candidate.interaction_id,
                    },
                    { onSuccess: () => onOpenChange(false) },
                  )
                }
              />
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    </SheetDialog>
  );
}
