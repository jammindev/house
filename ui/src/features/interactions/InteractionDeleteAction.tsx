import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { Button } from '@/design-system/button';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useDeleteInteraction } from './hooks';

interface InteractionDeleteActionProps {
  id: string;
  /** Où aller ensuite — la page courante éditerait sinon un objet disparu. */
  onDeleted: () => void;
  /** Texte de confirmation ; par défaut celui du journal. */
  description?: string;
  className?: string;
  label?: string;
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
}: InteractionDeleteActionProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const deleteMutation = useDeleteInteraction();

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
        description={description ?? t('interactions.delete_confirm')}
        onConfirm={() => deleteMutation.mutate(id, { onSuccess: onDeleted })}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
