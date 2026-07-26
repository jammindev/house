import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/design-system/card';
import { Button } from '@/design-system/button';
import { formatAmount } from '@/lib/format';
import { useComplianceGroup } from '@/features/money/hooks';
import { EXPENSE_UNRECONCILED } from '@/features/money/keys';
import { useLinkInteraction } from './hooks';

interface UnreconciledPickerProps {
  transactionId: string;
  /** Montant encore libre sur la ligne, en string décimale. */
  remaining: string;
  /** Ids déjà proposés par le matcher — on ne les répète pas. */
  excludeIds: string[];
  onLinked?: () => void;
}

/**
 * Rattacher une dépense déjà saisie à cette ligne — le chemin que le matcher ne
 * peut pas prendre.
 *
 * Un achat de 90 € saisi depuis une page projet ne sera **jamais** proposé pour une
 * ligne de 150 € : `score_pair` rejette au-delà de la tolérance de montant, par
 * construction, et c'est bien ainsi — un écart de 60 € n'est pas un appariement
 * plausible. Mais c'est un cas d'usage réel : les 90 € sont *une partie* de la
 * ligne. D'où ce sélecteur explicite, qui assume ce que le matcher refuse de
 * deviner.
 *
 * La liste vient du détecteur `expense_unreconciled` : c'est déjà l'inventaire des
 * dépenses que la banque n'a jamais confirmées, donc exactement le vivier. Les
 * candidates plus grosses que le reste à ventiler sont masquées — le serveur les
 * refuserait (`assert_allocation_fits`), et proposer un bouton qui échoue est pire
 * que ne rien proposer.
 */
export default function UnreconciledPicker({
  transactionId,
  remaining,
  excludeIds,
  onLinked,
}: UnreconciledPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const groupQuery = useComplianceGroup(open ? EXPENSE_UNRECONCILED : undefined, { limit: 50 });
  const linkMutation = useLinkInteraction();

  const remainingValue = Number(remaining);
  const excluded = React.useMemo(() => new Set(excludeIds), [excludeIds]);

  const candidates = React.useMemo(() => {
    const rows = groupQuery.data?.results ?? [];
    return rows
      .filter((finding) => !excluded.has(finding.object_id))
      .map((finding) => {
        const detail = finding.detail as Record<string, string | undefined>;
        return {
          id: finding.object_id,
          subject: detail.subject ?? finding.label,
          amount: detail.amount ?? '0',
          occurredAt: detail.occurred_at ?? '',
        };
      })
      .filter((row) => Number(row.amount) <= remainingValue + 0.001);
  }, [groupQuery.data, excluded, remainingValue]);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t('banking.reconcile.pickExisting')}
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {t('banking.reconcile.pickExistingHint', { amount: formatAmount(remaining) })}
      </p>

      {groupQuery.isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-muted" />
      ) : candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('banking.reconcile.noUnreconciled')}
        </p>
      ) : (
        <div className="space-y-1.5">
          {candidates.map((candidate) => (
            <Card key={candidate.id} className="flex items-center gap-2 p-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate text-foreground">{candidate.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {candidate.occurredAt
                    ? new Date(candidate.occurredAt).toLocaleDateString()
                    : ''}
                </p>
              </div>
              <span className="shrink-0 tabular-nums text-foreground">
                {formatAmount(candidate.amount)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={linkMutation.isPending}
                onClick={() =>
                  linkMutation.mutate(
                    { transactionId, interactionId: candidate.id },
                    { onSuccess: () => onLinked?.() },
                  )
                }
              >
                {t('banking.reconcile.attach')}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
