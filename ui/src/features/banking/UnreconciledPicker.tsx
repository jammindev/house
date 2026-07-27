import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/design-system/card';
import { Button } from '@/design-system/button';
import { formatAmount, formatDate } from '@/lib/format';
import { fetchInteractions } from '@/lib/api/interactions';
import { interactionKeys } from '@/features/interactions/hooks';
import { useLinkInteraction } from './hooks';

interface UnreconciledPickerProps {
  transactionId: string;
  /** Montant encore libre sur la ligne, en string décimale. */
  remaining: string;
  /** Ids déjà proposés par le matcher — on ne les répète pas. */
  excludeIds?: string[];
  /** Déplié d'emblée : au moment de ventiler, la question doit se poser seule. */
  defaultOpen?: boolean;
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
 * ⚠️ La liste vient de `?unreconciled=true&max_amount=`, **pas** du détecteur de
 * conformité. Elle en venait, et c'était un piège : le détecteur est borné par la
 * fenêtre de conformité, donc une dépense saisie après le dernier relevé importé
 * — celle qu'on vient justement de créer et qu'on risque de re-créer en double —
 * n'était pas proposée. « Qu'est-ce qui existe déjà ? » n'est pas la même question
 * que « qu'est-ce que je dois réclamer ? ».
 *
 * Les candidates plus grosses que le reste à ventiler sont exclues côté serveur :
 * le serveur les refuserait (`assert_allocation_fits`), et proposer un bouton qui
 * échoue est pire que ne rien proposer.
 */
export default function UnreconciledPicker({
  transactionId,
  remaining,
  excludeIds = [],
  defaultOpen = false,
  onLinked,
}: UnreconciledPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(defaultOpen);
  const linkMutation = useLinkInteraction();

  const filters = React.useMemo(
    () => ({ unreconciled: true, max_amount: remaining, limit: 50 }),
    [remaining],
  );
  const query = useQuery({
    queryKey: interactionKeys.list(filters),
    queryFn: () => fetchInteractions(filters),
    enabled: Number(remaining) > 0,
  });

  const excluded = React.useMemo(() => new Set(excludeIds), [excludeIds]);
  const candidates = React.useMemo(
    () => (query.data?.items ?? []).filter((item) => !excluded.has(item.id)),
    [query.data, excluded],
  );

  if (candidates.length === 0) return null;

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t('banking.reconcile.pickExisting')}
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/5 p-3">
      <p className="text-xs font-medium text-foreground">
        {t('banking.reconcile.alreadyTyped', { count: candidates.length })}
      </p>
      <p className="text-xs text-muted-foreground">
        {t('banking.reconcile.pickExistingHint', { amount: formatAmount(remaining) })}
      </p>

      <div className="space-y-1.5">
        {candidates.map((candidate) => (
          <Card key={candidate.id} className="flex items-center gap-2 p-2 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate text-foreground">{candidate.subject}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(candidate.occurred_at)}
                {candidate.supplier ? ` · ${candidate.supplier}` : ''}
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
    </div>
  );
}
