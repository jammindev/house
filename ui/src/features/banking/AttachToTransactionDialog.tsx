import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Button } from '@/design-system/button';
import { Card } from '@/design-system/card';
import { formatAmount, formatDate } from '@/lib/format';
import { useLinkInteraction, useTransactions } from './hooks';

interface AttachToTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: { id: string; subject: string; amount: string | null; occurred_at: string };
}

/** Écart en jours entre la dépense et la ligne — le seul tri qui aide vraiment. */
function dayGap(a: string, b: string): number {
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime());
  return Math.round(ms / 86_400_000);
}

/**
 * Rattacher cette dépense à une opération — le sens inverse d'`UnreconciledPicker`.
 *
 * Le rapprochement se faisait uniquement depuis la ligne : on partait du relevé
 * et on cherchait la dépense. Mais l'utilisateur part souvent de l'autre bout —
 * il lit « En attente de rapprochement » sur une dépense et veut désigner
 * l'opération. Sans ce dialogue, le constat était posé partout sans l'action à
 * côté.
 *
 * Les candidates viennent du serveur avec `fits` : seules les lignes dont le
 * **reste à ventiler** couvre le montant. Le calculer ici serait impossible — le
 * reste est une annotation — et proposer une ligne trop petite offrirait un
 * bouton qui échoue (`assert_allocation_fits`), ce qui est pire que ne rien
 * proposer.
 *
 * Une dépense de 90 € peut ainsi se rattacher à une ligne de 150 € : elle en
 * couvre *une partie*, et les 60 € restants restent à ventiler. C'est
 * exactement ce que le matcher automatique refuse de deviner.
 */
export default function AttachToTransactionDialog({
  open,
  onOpenChange,
  expense,
}: AttachToTransactionDialogProps) {
  const { t } = useTranslation();
  const linkMutation = useLinkInteraction();

  const amount = expense.amount ?? '0';
  const query = useTransactions(
    React.useMemo(() => ({ fits: amount }), [amount]),
    50,
    { enabled: open && Number(amount) > 0 },
  );

  // Le plus proche en date d'abord : à montant égal, c'est la seule indication
  // qui distingue deux lignes plausibles.
  const candidates = React.useMemo(() => {
    const rows = query.data?.results ?? [];
    return [...rows].sort(
      (a, b) =>
        dayGap(a.booked_on, expense.occurred_at) - dayGap(b.booked_on, expense.occurred_at),
    );
  }, [query.data, expense.occurred_at]);

  return (
    <SheetDialog open={open} onOpenChange={onOpenChange} title={t('banking.attach.title')}>
      <div className="mt-4 space-y-4">
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <p className="font-medium text-foreground">{expense.subject}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(expense.occurred_at)} · {formatAmount(expense.amount)}
          </p>
        </div>

        <p className="text-xs text-muted-foreground">{t('banking.attach.hint')}</p>

        {query.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('banking.attach.none')}</p>
        ) : (
          <ul className="space-y-2">
            {candidates.map((line) => (
              <li key={line.id}>
                <Card className="flex items-center gap-2 p-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-foreground">{line.label_raw}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(line.booked_on)}
                      {Number(line.remaining_amount) > Number(amount)
                        ? ` · ${t('banking.attach.remaining', {
                            amount: formatAmount(line.remaining_amount),
                          })}`
                        : ''}
                    </p>
                  </div>
                  <span className="shrink-0 tabular-nums text-foreground">
                    {formatAmount(line.amount)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={linkMutation.isPending}
                    onClick={() =>
                      linkMutation.mutate(
                        { transactionId: line.id, interactionId: expense.id },
                        { onSuccess: () => onOpenChange(false) },
                      )
                    }
                  >
                    {t('banking.reconcile.attach')}
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
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
