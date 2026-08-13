import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { Button } from '@/design-system/button';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useUndoStockPurchase } from '@/features/stock/hooks';
import { useDeleteInteraction } from './hooks';

/** Ce qu'un achat de stock a ajouté, et qu'on peut retirer avec la dépense. */
export interface StockPurchaseRevert {
  itemName: string;
  delta: string;
  unit: string;
}

interface InteractionDeleteActionProps {
  id: string;
  /** Où aller ensuite — la page courante éditerait sinon un objet disparu. */
  onDeleted: () => void;
  /** Texte de confirmation ; par défaut celui du journal. */
  description?: string;
  className?: string;
  label?: string;
  /**
   * Renseigné pour une dépense née d'un achat de stock : la confirmation offre
   * alors de retirer aussi le mouvement.
   *
   * Sans ça, supprimer la dépense laissait la lecture de niveau derrière elle,
   * sa source à `NULL` (la FK est en `SET_NULL`) et la quantité inchangée : le
   * saut restait sur la courbe sans que rien ne dise d'où il venait. C'est
   * l'orphelin muet que le parcours 26 interdit partout ailleurs dans l'argent.
   */
  stockPurchase?: StockPurchaseRevert;
}

/**
 * Supprimer une entrée du journal — **un seul geste, trois écrans**.
 *
 * La fiche, la fiche de dépense et le formulaire d'édition posent la même
 * question, avec la même confirmation et la même sortie. Le formulaire d'édition
 * ne l'offrait pas du tout : on y arrive pour corriger un montant, on y découvre
 * que la dépense n'a rien à faire là, et il fallait ressortir pour la supprimer.
 *
 * Pas d'undo ici, contrairement aux listes : une page ne peut pas afficher une
 * suppression optimiste puisqu'elle disparaît avec son objet. La confirmation
 * joue ce rôle, et c'est le seul endroit du projet où elle le joue.
 */
export default function InteractionDeleteAction({
  id,
  onDeleted,
  description,
  className = 'h-8 px-3 text-sm',
  label,
  stockPurchase,
}: InteractionDeleteActionProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  // Coché par défaut : une dépense d'achat qu'on supprime est presque toujours
  // une saisie à annuler, pas un article qu'on garde. Décocher reste à un clic,
  // et c'est écrit — c'est le silence qu'on répare, pas le choix.
  const [alsoRevertStock, setAlsoRevertStock] = React.useState(true);
  const deleteMutation = useDeleteInteraction();
  const undoPurchaseMutation = useUndoStockPurchase();

  React.useEffect(() => {
    if (open) setAlsoRevertStock(true);
  }, [open]);

  const revert = Boolean(stockPurchase) && alsoRevertStock;
  const pending = revert ? undoPurchaseMutation.isPending : deleteMutation.isPending;

  function confirm() {
    if (revert) {
      undoPurchaseMutation.mutate(id, { onSuccess: onDeleted });
      return;
    }
    deleteMutation.mutate(id, { onSuccess: onDeleted });
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        className={className}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
        {label ?? t('common.delete')}
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t('common.confirmDelete')}
        description={
          stockPurchase
            ? t('interactions.delete_confirm_stock_purchase', { ...stockPurchase })
            : description ?? t('interactions.delete_confirm')
        }
        onConfirm={confirm}
        loading={pending}
      >
        {stockPurchase ? (
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={alsoRevertStock}
              onChange={(e) => setAlsoRevertStock(e.target.checked)}
            />
            <span>{t('interactions.delete_revert_stock', { ...stockPurchase })}</span>
          </label>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
