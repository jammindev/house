import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Link2Off, Trash2 } from 'lucide-react';
import { Button } from '@/design-system/button';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { interactionKeys, useDeleteInteraction } from '@/features/interactions/hooks';
import type { InteractionListItem } from '@/lib/api/interactions';
import { useUnlinkAllocation } from './hooks';
import { isOwnedByAllocationEditor } from './ownership';

interface LinkedLineActionsProps {
  expenseId: string;
  /** Discriminateur de la dépense — décide **lequel** des deux gestes s'applique. */
  kind?: string | null;
  /** L'opération qui la justifie (`bank_line.id`). */
  transactionId: string;
  /**
   * Appelé quand la dépense vient d'être supprimée — une page de détail doit
   * sortir, elle éditerait sinon un objet qui n'existe plus. Volontairement pas
   * appelé sur un détachement : là, la dépense reste, et voir son badge passer à
   * « en attente » sous ses yeux vaut mieux qu'une navigation.
   */
  onDeleted?: () => void;
  className?: string;
}

interface CachedList {
  items: InteractionListItem[];
  count: number;
}

function isCachedList(value: unknown): value is CachedList {
  return Boolean(value) && Array.isArray((value as CachedList).items);
}

/**
 * Défaire le rattachement — au même endroit que le constat.
 *
 * Il y a **deux gestes**, et ils ne portent pas sur la même chose :
 *
 * - une dépense rapprochée après coup (saisie à la main, achat de projet,
 *   occurrence de récurrence) se **détache** : le fait préexistait au relevé, il
 *   survit sans sa justification ;
 * - une dépense née de la ventilation (`kind='bank'`) **est** la ventilation. La
 *   détacher laisserait d'un seul coup une dépense que plus rien ne justifie *et*
 *   une sortie redevenue partiellement ventilée — deux écarts pour le même argent.
 *   Le geste juste est donc de la **supprimer** : la ligne bancaire, elle, n'est
 *   jamais touchée — elle redevient simplement à ranger.
 *
 * ⚠️ La suppression ne porte que sur **cette** dépense. Sur une ligne partagée en
 * 90 € + 60 €, les 60 € restent et la ligne réapparaît dans « À ranger » avec 90 €
 * à replacer. Effacer tout le découpage d'un clic détruirait un travail fini pour
 * corriger une de ses lignes.
 */
export default function LinkedLineActions({
  expenseId,
  kind,
  transactionId,
  onDeleted,
  className = 'h-6 px-2 text-xs',
}: LinkedLineActionsProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const unlinkMutation = useUnlinkAllocation();
  const deleteMutation = useDeleteInteraction();

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('banking.attach.splitRemoved'),
    onDelete: (id) => deleteMutation.mutateAsync(id),
  });

  // Retrait optimiste de **toutes** les listes en cache, pas seulement de celle
  // qu'on regarde : le composant est posé dans trois écrans qui ne connaissent
  // pas leurs filtres respectifs, et laisser une ligne supprimée dans un onglet
  // voisin est la moitié d'un bug de comptage. L'annulation, elle, refait
  // confiance au serveur — la suppression n'a pas encore été envoyée.
  function removeFromLists() {
    qc.setQueriesData({ queryKey: interactionKeys.all }, (old: unknown) =>
      isCachedList(old)
        ? {
            ...old,
            items: old.items.filter((i) => i.id !== expenseId),
            count: Math.max(0, old.count - 1),
          }
        : old,
    );
  }

  if (isOwnedByAllocationEditor(kind)) {
    return (
      <Button
        type="button"
        variant="outline"
        className={className}
        title={t('banking.attach.removeSplitHint')}
        onClick={(e) => {
          e.stopPropagation();
          deleteWithUndo(expenseId, {
            onRemove: removeFromLists,
            onRestore: () => void qc.invalidateQueries({ queryKey: interactionKeys.all }),
          });
          onDeleted?.();
        }}
      >
        <Trash2 className="mr-1 h-3 w-3" />
        {t('banking.attach.removeSplit')}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      disabled={unlinkMutation.isPending}
      title={t('banking.allocation.linked.detach')}
      onClick={(e) => {
        e.stopPropagation();
        unlinkMutation.mutate({ transactionId, interactionId: expenseId });
      }}
    >
      <Link2Off className="mr-1 h-3 w-3" />
      {t('banking.attach.detach')}
    </Button>
  );
}
