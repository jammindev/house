import { useTranslation } from 'react-i18next';
import { SheetDialog } from '@/design-system/sheet-dialog';
import PurchaseForm from '@/features/interactions/PurchaseForm';
import type { Tree } from '@/lib/api/orchard';
import { usePurchaseTree } from './hooks';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tree: Tree;
}

/**
 * « Déclarer un achat » sur un sujet — le `PurchaseForm` partagé, rien de plus.
 *
 * Le dialogue n'apporte que son contexte (le sujet, la mutation, le titre) : les
 * champs prix / fournisseur / date / notes sont ceux de toutes les autres
 * features, et la dépense elle-même est construite côté serveur par
 * `create_expense_interaction`. Un formulaire d'achat propre au verger aurait
 * donné à l'argent une deuxième définition.
 */
export default function TreePurchaseDialog({ open, onOpenChange, tree }: Props) {
  const { t } = useTranslation();
  const purchase = usePurchaseTree();

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('orchard.purchase.title', { name: tree.name })}
    >
      <PurchaseForm
        isPending={purchase.isPending}
        onCancel={() => onOpenChange(false)}
        onSubmit={async (payload) => {
          // Le form partagé porte des champs propres au stock (delta, marque,
          // reste avant achat) : le verger n'en garde que ce qu'une dépense
          // signifie pour lui. Les recopier ne ferait qu'ajouter du bruit dans
          // `metadata`.
          await purchase.mutateAsync({
            id: tree.id,
            payload: {
              amount: String(payload.amount ?? ''),
              supplier: payload.supplier,
              occurred_at: payload.occurred_at ?? undefined,
              notes: payload.notes,
              budget_id: payload.budget_id,
            },
          });
          onOpenChange(false);
        }}
      />
    </SheetDialog>
  );
}
