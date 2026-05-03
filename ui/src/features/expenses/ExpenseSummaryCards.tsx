import { useTranslation } from 'react-i18next';
import { Card } from '@/design-system/card';
import type { ExpenseSummary } from '@/lib/api/expenses';

interface ExpenseSummaryCardsProps {
  summary: ExpenseSummary;
}

function formatAmount(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(numeric);
}

export default function ExpenseSummaryCards({ summary }: ExpenseSummaryCardsProps) {
  const { t } = useTranslation();
  const topKinds = summary.by_kind.slice(0, 4);
  const topSuppliers = summary.by_supplier.filter((row) => row.supplier).slice(0, 3);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Card className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('expenses.summary.total')}
        </p>
        <p className="mt-2 text-3xl font-semibold tabular-nums">{formatAmount(summary.total)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('expenses.summary.count', { count: summary.count })}
        </p>
      </Card>

      <Card className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('expenses.summary.byKind')}
        </p>
        {topKinds.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t('expenses.summary.empty')}</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {topKinds.map((row) => (
              <li key={row.kind || 'unknown'} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-muted-foreground">
                  {t(`expenses.kind.${row.kind}`, { defaultValue: row.kind || t('expenses.kind.unknown') })}
                </span>
                <span className="shrink-0 tabular-nums">{formatAmount(row.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('expenses.summary.bySupplier')}
        </p>
        {topSuppliers.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t('expenses.summary.empty')}</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {topSuppliers.map((row) => (
              <li key={row.supplier} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-muted-foreground">{row.supplier}</span>
                <span className="shrink-0 tabular-nums">{formatAmount(row.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
