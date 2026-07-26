import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { FormField } from '@/design-system/form-field';
import { Textarea } from '@/design-system/textarea';
import { Button } from '@/design-system/button';
import { useWaiveFinding } from './hooks';

export interface WaiverTarget {
  kind: string;
  objectIds: string[];
  /** Libellé de l'écart, ou nombre d'écarts pour un arbitrage groupé. */
  label: string;
  /** Motif précédent, quand on ré-arbitre un arbitrage périmé. */
  previousReason?: string;
}

interface WaiverDialogProps {
  target: WaiverTarget | null;
  onClose: () => void;
}

/**
 * Arbitrer un écart — et **jamais** l'écarter en silence.
 *
 * Le motif est obligatoire, ici comme côté serveur. C'est la différence entre un
 * arbitrage (une décision qu'on peut relire dans six mois, et révoquer) et un
 * bouton « masquer », qui ne laisserait rien derrière lui.
 *
 * Sur un arbitrage **périmé**, le motif d'origine est pré-rempli : la situation a
 * changé, mais la raison qu'on avait est le meilleur point de départ pour décider
 * si elle tient toujours.
 */
export default function WaiverDialog({ target, onClose }: WaiverDialogProps) {
  const { t } = useTranslation();
  const waive = useWaiveFinding();
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!target) return;
    setReason(target.previousReason ?? '');
    setError(null);
  }, [target]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!target) return;

    const trimmed = reason.trim();
    if (!trimmed) {
      setError(t('money.compliance.reasonRequired'));
      return;
    }

    try {
      // Séquentiel plutôt que Promise.all : un arbitrage groupé de 15 lignes ne
      // doit pas ouvrir 15 requêtes concurrentes sur le même détecteur.
      for (const objectId of target.objectIds) {
        await waive.mutateAsync({
          finding_kind: target.kind,
          object_id: objectId,
          reason: trimmed,
        });
      }
      onClose();
    } catch {
      setError(t('common.saveFailed'));
    }
  }

  return (
    <SheetDialog
      open={Boolean(target)}
      onOpenChange={(next) => !next && onClose()}
      title={t('money.compliance.waiveTitle')}
    >
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <p className="text-sm text-muted-foreground">{t('money.compliance.waiveHelp')}</p>

        {target ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
            {target.label}
          </div>
        ) : null}

        <FormField label={`${t('money.compliance.reason')} *`} htmlFor="waiver-reason">
          <Textarea
            id="waiver-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={t('money.compliance.reasonPlaceholder')}
            autoFocus
          />
        </FormField>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={waive.isPending}>
            {t('money.compliance.waiveAction')}
          </Button>
        </div>
      </form>
    </SheetDialog>
  );
}
