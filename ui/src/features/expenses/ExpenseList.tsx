import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Link2, Store } from 'lucide-react';
import { Card, CardTitle } from '@/design-system/card';
import { Badge } from '@/design-system/badge';
import { CheckboxField } from '@/design-system/checkbox-field';
import { Button } from '@/design-system/button';
import { formatAmount, formatDate } from '@/lib/format';
import { pushBack } from '@/lib/backNavigation';
import ReconciliationBadge from '@/features/money/ReconciliationBadge';
import AttachToTransactionDialog from '@/features/banking/AttachToTransactionDialog';
import LinkedLineActions from '@/features/banking/LinkedLineActions';
import type { InteractionListItem } from '@/lib/api/interactions';

interface ExpenseListProps {
  items: InteractionListItem[];
  /**
   * Fourni = mode sélection : cliquer une ligne coche au lieu d'ouvrir sa fiche.
   * Un `undefined` porte le mode normal, donc la liste n'a pas de booléen de plus
   * à tenir — même contrat que la grille photos.
   */
  onToggleSelected?: (item: InteractionListItem) => void;
  isSelected?: (item: InteractionListItem) => boolean;
  /**
   * Signale les dépenses auxquelles il manque un fournisseur. Même règle que le
   * `flagWithoutZone` de la galerie photos : la pastille n'a de sens que là où
   * le manque est **actionnable**.
   *
   * Elle a d'abord été réservée à l'onglet Dépenses, la fiche d'un budget ne
   * posant pas cette question. Elle l'y pose depuis qu'elle porte le filtre
   * « sans fournisseur » et la correction en lot : la pastille montre alors ce
   * que le filtre irait chercher. Elle reste optionnelle pour les listes futures
   * qui ne proposeront ni l'un ni l'autre — une pastille qui n'ouvre sur aucun
   * geste n'avertit de rien.
   */
  flagWithoutSupplier?: boolean;
}

export default function ExpenseList({
  items,
  onToggleSelected,
  isSelected,
  flagWithoutSupplier,
}: ExpenseListProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [attachTarget, setAttachTarget] = React.useState<InteractionListItem | null>(null);
  const selecting = Boolean(onToggleSelected);

  return (
    <>
      <ul className="space-y-2">
        {items.map((item) => {
          const amount = item.amount ? formatAmount(item.amount) : null;
          // Le geste va là où le constat s'affiche. Il vivait sur la fiche d'une
          // dépense — devenue inatteignable depuis que les dépenses ont quitté la
          // page Activité, qui était le seul chemin vers elle. Une action qu'on ne
          // peut pas atteindre n'existe pas.
          // Masquées pendant la sélection, comme les actions d'une vignette photo :
          // un geste sur une seule ligne au milieu d'un lot en cours de composition
          // fait douter de ce sur quoi le prochain clic va porter.
          const canAttach = !selecting && !item.bank_line && Boolean(item.amount);
          const picked = isSelected?.(item) ?? false;
          // `supplier` vient de la liste, jamais déduit autrement : c'est la même
          // source que le filtre « Sans fournisseur », sinon la pastille et le
          // filtre pourraient se contredire sur la même dépense. Le `trim` couvre
          // les valeurs d'espaces d'un import historique, comme le filtre serveur.
          const withoutSupplier = flagWithoutSupplier && !(item.supplier ?? '').trim();

          return (
            <li key={item.id}>
              <Card
                className={`cursor-pointer p-3 transition-shadow hover:shadow-md ${
                  picked ? 'border-primary/50 bg-primary/5' : ''
                }`}
                /* Cliquer une dépense ouvre sa **fiche**, plus un formulaire :
                   on clique pour lire, et un champ de saisie ne se lit pas. En
                   mode sélection, le même clic coche — viser une case de 16 px
                   sur mobile pour cocher douze lignes est un supplice. */
                onClick={() =>
                  selecting
                    ? onToggleSelected?.(item)
                    : navigate(`/app/money/expenses/${item.id}`, { state: pushBack(location) })
                }
              >
                <div className="flex items-start justify-between gap-3">
                  {selecting ? (
                    <div className="pt-0.5">
                      <CheckboxField
                        id={`pick-${item.id}`}
                        label=""
                        checked={picked}
                        onChange={() => onToggleSelected?.(item)}
                      />
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>{item.subject}</CardTitle>
                      {item.kind ? (
                        <Badge variant="outline" className="text-xs">
                          {t(`expenses.kind.${item.kind}`)}
                        </Badge>
                      ) : null}
                      <ReconciliationBadge
                        state={item.reconciliation_state}
                        line={item.bank_line}
                      />
                      {withoutSupplier ? (
                        <span className="flex items-center gap-1 rounded-full bg-warning/90 px-2 py-0.5 text-[10px] font-medium text-warning-foreground">
                          <Store className="h-3 w-3" aria-hidden />
                          {t('expenses.withoutSupplier')}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{formatDate(item.occurred_at)}</span>
                      {item.supplier ? <span>{item.supplier}</span> : null}
                      {canAttach ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAttachTarget(item);
                          }}
                        >
                          <Link2 className="mr-1 h-3 w-3" />
                          {t('banking.attach.action')}
                        </Button>
                      ) : null}
                      {/* Et son inverse, à la même place : rattacher la mauvaise
                          ligne est une erreur d'un clic, s'en dédire ne doit pas
                          demander d'aller la chercher dans l'autre module. */}
                      {item.bank_line && !selecting ? (
                        <LinkedLineActions
                          expenseId={item.id}
                          kind={item.kind}
                          transactionId={item.bank_line.id}
                        />
                      ) : null}
                    </div>
                  </div>
                  {amount ? (
                    <p className="shrink-0 text-base font-semibold tabular-nums">{amount}</p>
                  ) : (
                    <p className="shrink-0 text-xs italic text-muted-foreground">
                      {t('expenses.list.noAmount')}
                    </p>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      {attachTarget ? (
        <AttachToTransactionDialog
          open
          onOpenChange={(next) => !next && setAttachTarget(null)}
          expense={{
            id: attachTarget.id,
            subject: attachTarget.subject,
            amount: attachTarget.amount ?? null,
            occurred_at: attachTarget.occurred_at,
          }}
        />
      ) : null}
    </>
  );
}
