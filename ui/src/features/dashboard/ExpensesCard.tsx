import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardTitle } from '@/design-system/card';
import { cn } from '@/lib/utils';
import { pushBack } from '@/lib/backNavigation';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useExpenseSummary } from '@/features/expenses/hooks';
import { isoDate } from './hooks';

const MONTHS_SHOWN = 6;

function formatEur(amount: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Last 6 calendar months (oldest first), current month included. */
function lastMonths(): string[] {
  const now = new Date();
  return Array.from({ length: MONTHS_SHOWN }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS_SHOWN - 1 - i), 1);
    return monthKey(d);
  });
}

export default function ExpensesCard() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const months = lastMonths();
  const from = `${months[0]}-01`;
  const { data, isLoading } = useExpenseSummary({ from, to: isoDate(new Date()) });
  const showSkeleton = useDelayedLoading(isLoading);

  if (showSkeleton) return <Card className="h-36 animate-pulse bg-muted p-4" />;
  if (!data || data.count === 0) return null;

  const totalsByMonth = new Map(data.by_month.map((row) => [row.month, parseFloat(row.total)]));
  const series = months.map((month) => ({ month, total: totalsByMonth.get(month) ?? 0 }));
  const current = series[series.length - 1].total;
  const previous = series[series.length - 2].total;
  const deltaPct = previous > 0 ? ((current - previous) / previous) * 100 : null;
  const max = Math.max(...series.map((row) => row.total), 1);

  return (
    <Link to="/app/expenses" state={pushBack(location)} className="group block h-full">
      <Card className="flex h-full flex-col p-4 transition-colors hover:border-border hover:bg-muted/20">
        <CardTitle className="text-sm text-muted-foreground">
          💶 {t('dashboard.metrics.expenses.title')}
        </CardTitle>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          {formatEur(current)}
        </p>
        {deltaPct !== null ? (
          <p
            className={cn(
              'mt-0.5 flex items-center gap-1 text-xs font-medium',
              deltaPct <= 0 ? 'text-primary' : 'text-destructive',
            )}
          >
            {deltaPct <= 0 ? (
              <TrendingDown className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <TrendingUp className="h-3.5 w-3.5" aria-hidden />
            )}
            {t('dashboard.metrics.expenses.delta', {
              percent: `${deltaPct > 0 ? '+' : ''}${Math.round(deltaPct)}`,
            })}
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('dashboard.metrics.expenses.subtitle')}
          </p>
        )}
        <div className="mt-auto flex h-12 items-end gap-1 pt-3" aria-hidden>
          {series.map((row, i) => (
            <div key={row.month} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
              <div
                className={cn(
                  'w-full rounded-sm',
                  i === series.length - 1 ? 'bg-primary' : 'bg-primary/25',
                )}
                style={{ height: `${Math.max((row.total / max) * 100, 4)}%` }}
              />
              <span className="text-[9px] leading-none text-muted-foreground/70">
                {new Intl.DateTimeFormat(i18n.language, { month: 'narrow' }).format(
                  new Date(`${row.month}-01T00:00:00`),
                )}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </Link>
  );
}
