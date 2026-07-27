import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Link2Off, Pencil } from 'lucide-react';
import { Button, buttonVariants } from '@/design-system/button';
import { cn } from '@/lib/utils';
import { pushBack } from '@/lib/backNavigation';
import { useUnlinkAllocation } from './hooks';
import { isOwnedByAllocationEditor } from './ownership';

interface LinkedLineActionsProps {
  expenseId: string;
  /** Discriminateur de la dépense — décide **lequel** des deux gestes s'applique. */
  kind?: string | null;
  /** L'opération qui la justifie (`bank_line.id`). */
  transactionId: string;
  className?: string;
}

/**
 * Le geste qui défait le rattachement — au même endroit que le constat.
 *
 * Il y en a **deux**, et confondre les deux fabrique de l'argent en double :
 *
 * - une dépense rapprochée après coup (saisie à la main, achat de projet,
 *   occurrence de récurrence) se **détache** : le fait reste, la justification
 *   s'en va ;
 * - une dépense née de la ventilation (`kind='bank'`) **est** la ventilation.
 *   La détacher ne libère rien : elle laisserait d'un seul geste une dépense que
 *   plus rien ne justifie *et* une sortie redevenue partiellement ventilée — deux
 *   écarts pour le même argent. Ce qu'on veut alors, c'est réécrire ou supprimer
 *   la ventilation, ce qui se fait sur l'opération.
 *
 * D'où deux boutons et pas un bouton conditionnel : la version qui n'offrait que
 * le détachement n'affichait donc **rien** sur les dépenses issues d'un relevé,
 * c'est-à-dire sur la quasi-totalité d'un foyer qui importe ses relevés. Une
 * ligne avec un badge et aucun geste renvoie l'utilisateur chercher ailleurs ce
 * qu'il croit absent.
 */
export default function LinkedLineActions({
  expenseId,
  kind,
  transactionId,
  className = 'h-6 px-2 text-xs',
}: LinkedLineActionsProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const mutation = useUnlinkAllocation();

  if (isOwnedByAllocationEditor(kind)) {
    return (
      <Link
        to={`/app/money/transactions/${transactionId}`}
        state={pushBack(location)}
        onClick={(e) => e.stopPropagation()}
        className={cn(buttonVariants({ variant: 'outline' }), className)}
      >
        <Pencil className="mr-1 h-3 w-3" />
        {t('banking.attach.editSplit')}
      </Link>
    );
  }

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
