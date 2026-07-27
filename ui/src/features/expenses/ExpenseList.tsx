import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Link2 } from 'lucide-react';
import { Card, CardTitle } from '@/design-system/card';
import { Badge } from '@/design-system/badge';
import { Button } from '@/design-system/button';
import { formatAmount, formatDate } from '@/lib/format';
import ReconciliationBadge from '@/features/money/ReconciliationBadge';
import AttachToTransactionDialog from '@/features/banking/AttachToTransactionDialog';
import LinkedLineActions from '@/features/banking/LinkedLineActions';
import type { InteractionListItem } from '@/lib/api/interactions';

interface ExpenseListProps {
  items: InteractionListItem[];
}

export default function ExpenseList({ items }: ExpenseListProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [attachTarget, setAttachTarget] = React.useState<InteractionListItem | null>(null);

  return (
    <>
      <ul className="space-y-2">
        {items.map((item) => {
          const amount = item.amount ? formatAmount(item.amount) : null;
          // Le geste va là où le constat s'affiche. Il vivait sur la fiche d'une
          // dépense — devenue inatteignable depuis que les dépenses ont quitté la
          // page Activité, qui était le seul chemin vers elle. Une action qu'on ne
          // peut pas atteindre n'existe pas.
          const canAttach = !item.bank_line && Boolean(item.amount);

          return (
            <li key={item.id}>
              <Card
                className="cursor-pointer p-3 transition-shadow hover:shadow-md"
                onClick={() => navigate(`/app/interactions/${item.id}/edit`)}
              >
                <div className="flex items-start justify-between gap-3">
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
                      {item.bank_line ? (
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
