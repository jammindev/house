import { useTranslation } from 'react-i18next';
import { Card } from '@/design-system/card';
import { formatAmount } from '@/lib/format';
import type { ExpenseSummary } from '@/lib/api/expenses';
import type { AccountFlow } from '@/lib/api/banking';

interface ExpenseSummaryCardsProps {
  summary: ExpenseSummary;
  /** Vue « banque » de la même période, quand un compte est suivi. */
  flow?: AccountFlow;
}

export default function ExpenseSummaryCards({ summary, flow }: ExpenseSummaryCardsProps) {
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

      {/* Le pont banque ↔ dépenses : « rangé sur sorti », **jamais une somme** des
          deux (règle transverse de CLAUDE.md). C'est ce qui rend « 340 € dépensés »
          interprétable : sur combien réellement sorti du compte ? */}
      {flow ? (
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('expenses.summary.coverage')}
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {Math.round(flow.coverage_ratio * 100)}%
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('expenses.summary.coverageHint', {
              sorted: formatAmount(
                (Number(flow.outflow) - Number(flow.unallocated_outflow)).toFixed(2),
              ),
              outflow: formatAmount(flow.outflow),
            })}
          </p>
          {Number(flow.unallocated_outflow) > 0 ? (
            <p className="mt-1 text-xs text-destructive">
              {t('expenses.summary.coverageRemaining', {
                amount: formatAmount(flow.unallocated_outflow),
              })}
            </p>
          ) : null}
        </Card>
      ) : null}

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
                  {t(`expenses.kind.${row.kind || 'unknown'}`)}
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
