import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { Button } from '@/design-system/button';
import { formatAmount } from '@/lib/format';
import { useLinkTransferCounterpart, useTransferCandidates } from './hooks';

interface TransferLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string;
  /** Le libellé de l'opération dont on cherche l'autre jambe. */
  label: string;
}

/**
 * Déclarer qu'une autre opération est l'autre jambe de ce virement.
 *
 * Résout l'écart `internal_without_counterpart` dans le cas le plus courant, et
 * jusqu'ici le seul sans issue : un virement entre deux comptes qu'on a tous les
 * deux importés. `withdraw-to-cash` **fabrique** la jambe manquante, mais
 * uniquement sur un compte espèces ; ici les deux lignes existent déjà, et il ne
 * manquait que le geste qui dit qu'elles n'en font qu'une.
 *
 * **La liste vient du serveur.** Filtrer ici les montants opposés et les comptes
 * distincts donnerait une deuxième définition de ce qui est liable, et le jour où
 * elle dérive on propose un candidat que l'enregistrement refuse — l'utilisateur
 * n'a alors aucun moyen de savoir lequel des deux se trompe.
 */
export default function TransferLinkDialog({
  open,
  onOpenChange,
  transactionId,
  label,
}: TransferLinkDialogProps) {
  const { t } = useTranslation();
  const { data: candidates, isLoading } = useTransferCandidates(open ? transactionId : undefined);
  const mutation = useLinkTransferCounterpart();
  const [selected, setSelected] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setSelected(null);
    setError(null);
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setError(null);
    try {
      await mutation.mutateAsync({ transactionId, counterpartId: selected });
      onOpenChange(false);
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  return (
    <SheetDialog open={open} onOpenChange={onOpenChange} title={t('banking.transfer.title')}>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          {t('banking.transfer.hint', { label })}
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : null}

        {!isLoading && candidates && candidates.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
            {t('banking.transfer.empty')}
          </div>
        ) : null}

        {!isLoading && candidates && candidates.length > 0 ? (
          <div className="space-y-2" role="radiogroup" aria-label={t('banking.transfer.title')}>
            {candidates.map((candidate) => {
              const isSelected = selected === candidate.id;
              return (
                <button
                  key={candidate.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setSelected(candidate.id)}
                  className={`flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition ${
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card hover:border-primary/40'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {candidate.label_raw}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {candidate.account_name} · {candidate.booked_on}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-medium text-foreground">
                    {formatAmount(candidate.amount)}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={!selected || mutation.isPending}>
            {t('banking.transfer.confirm')}
          </Button>
        </div>
      </form>
    </SheetDialog>
  );
}
