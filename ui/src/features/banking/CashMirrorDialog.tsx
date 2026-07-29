import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { FormField } from '@/design-system/form-field';
import { Input } from '@/design-system/input';
import { Button } from '@/design-system/button';
import { formatAmount } from '@/lib/format';
import { useAdjustCashMirror } from './hooks';

interface CashMirrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string;
  /** Le retrait, en positif. */
  outflow: string;
  /** Ce qui a déjà été déclaré comme entré dans la caisse. */
  mirrored: string;
}

/**
 * Corriger **quelle part** d'un retrait est entrée dans la caisse.
 *
 * La résolution de l'écart `cash_mirror_partial`. Déclarer 60 € d'un retrait de
 * 100 € était possible dès le premier jour ; le corriger ne l'était pas — il
 * fallait délier puis refaire, ce qui détruit et recrée la ligne espèces.
 *
 * Le champ est **pré-rempli au montant total**, parce que c'est la correction
 * attendue dans la grande majorité des cas : l'écart existe le plus souvent parce
 * qu'un montant partiel a été saisi par erreur, pas par choix. Le choix, lui,
 * s'exprime en arbitrant l'écart avec son motif.
 */
export default function CashMirrorDialog({
  open,
  onOpenChange,
  transactionId,
  outflow,
  mirrored,
}: CashMirrorDialogProps) {
  const { t } = useTranslation();
  const mutation = useAdjustCashMirror();
  const [amount, setAmount] = React.useState(outflow);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setAmount(outflow);
    setError(null);
  }, [open, outflow]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = Number(amount.trim().replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > Number(outflow)) {
      setError(t('banking.withdraw.errors.amountInvalid', { max: formatAmount(outflow) }));
      return;
    }

    try {
      await mutation.mutateAsync({ transactionId, amount: parsed.toFixed(2) });
      onOpenChange(false);
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  return (
    <SheetDialog open={open} onOpenChange={onOpenChange} title={t('banking.withdraw.completeTitle')}>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          {t('banking.withdraw.completeHint', {
            outflow: formatAmount(outflow),
            mirrored: formatAmount(mirrored),
          })}
        </p>

        <FormField label={t('banking.withdraw.fields.amount')} htmlFor="cash-mirror-amount">
          <Input
            id="cash-mirror-amount"
            type="number"
            step="0.01"
            min="0"
            max={outflow}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
        </FormField>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </SheetDialog>
  );
}
