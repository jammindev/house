import { useTranslation } from 'react-i18next';
import { ArrowDownLeft, ArrowUpRight, Repeat } from 'lucide-react';
import { Card } from '@/design-system/card';
import { formatAmount } from '@/lib/format';
import type { AccountFlow } from '@/lib/api/banking';

interface FlowSummaryCardsProps {
  flow: AccountFlow;
}

/**
 * Vue « banque » : ce qui est réellement sorti et entré sur la période.
 *
 * Ces totaux ne se comparent PAS à ceux de la page Dépenses : celle-ci compte ce
 * que le foyer a rangé dans ses budgets, celle-là ce que la banque a débité. Ils
 * diffèrent tant que tout n'est pas ventilé — c'est normal, et l'écart est
 * l'information utile (taux de couverture, lot 7).
 */
export default function FlowSummaryCards({ flow }: FlowSummaryCardsProps) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <Card className="p-3">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ArrowUpRight className="h-3.5 w-3.5 text-destructive" aria-hidden />
          {t('banking.journal.outflow')}
        </p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
          {formatAmount(flow.outflow)}
        </p>
      </Card>

      <Card className="p-3">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ArrowDownLeft className="h-3.5 w-3.5 text-primary" aria-hidden />
          {t('banking.journal.inflow')}
        </p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
          {formatAmount(flow.inflow)}
        </p>
      </Card>

      <Card className="p-3">
        <p className="text-xs text-muted-foreground">{t('banking.journal.net')}</p>
        <p
          className={`mt-1 text-lg font-semibold tabular-nums ${
            Number(flow.net) < 0 ? 'text-destructive' : 'text-foreground'
          }`}
        >
          {formatAmount(flow.net)}
        </p>
        {flow.internal_count > 0 ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Repeat className="h-3 w-3" aria-hidden />
            {t('banking.journal.internalExcluded', { count: flow.internal_count })}
          </p>
        ) : null}
      </Card>
    </div>
  );
}
