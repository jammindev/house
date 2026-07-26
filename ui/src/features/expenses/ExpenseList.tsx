import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardTitle } from '@/design-system/card';
import { Badge } from '@/design-system/badge';
import { formatAmount, formatDate } from '@/lib/format';
import type { InteractionListItem } from '@/lib/api/interactions';

interface ExpenseListProps {
  items: InteractionListItem[];
}

/**
 * D'où vient cette dépense — la question que le parcours 26 rend visible.
 *
 * Trois provenances, et la troisième est la seule qui appelle une action : une
 * dépense saisie dans l'app que la banque n'a jamais confirmée est un écart, pas un
 * état normal. Le dire ici, dans la liste où on la lit, plutôt que seulement dans
 * l'onglet Contrôle.
 */
function provenanceOf(item: InteractionListItem): 'statement' | 'cash' | 'pending' {
  if (!item.bank_transaction) return 'pending';
  // Une dépense en espèces est née avec sa ligne (lot 4) : même provenance
  // technique qu'un relevé, mais un sens différent pour l'utilisateur — personne
  // n'a « rapproché » quoi que ce soit, l'opération a été saisie à la main.
  return item.reconciled_by === '' ? 'cash' : 'statement';
}

export default function ExpenseList({ items }: ExpenseListProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const amount = item.amount ? formatAmount(item.amount) : null;
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
                    <Badge
                      variant={
                        provenanceOf(item) === 'pending' ? 'destructive' : 'secondary'
                      }
                      className="text-xs"
                    >
                      {t(`expenses.provenance.${provenanceOf(item)}`)}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{formatDate(item.occurred_at)}</span>
                    {item.supplier ? <span>{item.supplier}</span> : null}
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
  );
}
