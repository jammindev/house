import { useTranslation } from 'react-i18next';
import { Link2Off } from 'lucide-react';
import { Button } from '@/design-system/button';
import { useUnlinkAllocation } from './hooks';
import { isOwnedByAllocationEditor } from './ownership';

interface DetachFromTransactionButtonProps {
  expenseId: string;
  /** Discriminateur de la dépense — décide si le geste lui est applicable. */
  kind?: string | null;
  /** L'opération dont on la détache (`bank_line.id`). */
  transactionId: string;
  className?: string;
}

/**
 * Détacher une dépense de l'opération qui la justifiait — l'inverse exact du
 * rattachement, au même endroit que lui.
 *
 * Le geste existait déjà côté relevé (bloc « Dépenses déjà rattachées » de
 * l'éditeur de ventilation), mais nulle part côté dépense : on pouvait donc
 * rattacher la mauvaise ligne depuis la liste des dépenses sans pouvoir s'en
 * dédire depuis le même écran. Un geste réversible dont l'annulation vit dans un
 * autre module n'est pas réversible en pratique.
 *
 * Ne rend rien sur une dépense née de la ventilation (voir `ownership.ts`) : là,
 * le badge mène déjà à l'opération, seul endroit où la retirer a un sens.
 */
export default function DetachFromTransactionButton({
  expenseId,
  kind,
  transactionId,
  className = 'h-6 px-2 text-xs',
}: DetachFromTransactionButtonProps) {
  const { t } = useTranslation();
  const mutation = useUnlinkAllocation();

  if (isOwnedByAllocationEditor(kind)) return null;

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      disabled={mutation.isPending}
      title={t('banking.allocation.linked.detach')}
      onClick={(e) => {
        e.stopPropagation();
        mutation.mutate({ transactionId, interactionId: expenseId });
      }}
    >
      <Link2Off className="mr-1 h-3 w-3" />
      {t('banking.attach.detach')}
    </Button>
  );
}
