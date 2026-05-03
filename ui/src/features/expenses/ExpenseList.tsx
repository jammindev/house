import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardTitle } from '@/design-system/card';
import { Badge } from '@/design-system/badge';
import type { InteractionListItem } from '@/lib/api/interactions';

interface ExpenseListProps {
  items: InteractionListItem[];
}

interface ExpenseMetadata {
  amount?: string | null;
  supplier?: string | null;
  kind?: string | null;
  unit_price?: string | null;
}

function formatAmount(value: string | null | undefined): string | null {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(numeric);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

export default function ExpenseList({ items }: ExpenseListProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const metadata = (item.metadata ?? {}) as ExpenseMetadata;
        const amount = formatAmount(metadata.amount ?? null);
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
                    {metadata.kind ? (
                      <Badge variant="outline" className="text-xs">
                        {t(`expenses.kind.${metadata.kind}`, { defaultValue: metadata.kind })}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{formatDate(item.occurred_at)}</span>
                    {metadata.supplier ? <span>{metadata.supplier}</span> : null}
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
