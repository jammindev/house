import * as React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PieChart, Repeat, Banknote } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BackLink from '@/components/BackLink';
import InfoField from '@/components/InfoField';
import LoadError from '@/components/LoadError';
import ListSkeleton from '@/components/ListSkeleton';
import { Badge } from '@/design-system/badge';
import { Button } from '@/design-system/button';
import { Card, CardTitle } from '@/design-system/card';
import { pushBack } from '@/lib/backNavigation';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { formatAmount, formatDate } from '@/lib/format';
import type { AllocatedExpense } from '@/lib/api/banking';
import { useAllocations, useBankAccounts } from './hooks';
import AllocationDialog from './AllocationDialog';

/**
 * Une ligne de relevé, en entier.
 *
 * Elle existe parce qu'une dépense doit pouvoir dire *à quoi* elle est
 * rapprochée. Un lien vers le journal filtré n'aurait pas suffi : sur un relevé
 * de 160 lignes, la ligne visée est page trois, et « la voici quelque part dans
 * cette liste » ne vérifie rien.
 *
 * Ce que cette page montre et que le journal ne peut pas : les **autres**
 * ventilations de la même opération. Arriver ici depuis une dépense de 90 €,
 * c'est découvrir que la ligne en faisait 150 et que les 60 restants sont
 * ailleurs — ou nulle part.
 */
export default function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [allocateOpen, setAllocateOpen] = React.useState(false);

  const { data, isLoading, error } = useAllocations(id);
  const accountsQuery = useBankAccounts(true);
  const showSkeleton = useDelayedLoading(isLoading);

  if (!id) return null;
  if (showSkeleton) return <ListSkeleton className="space-y-2 p-4" />;
  if (isLoading) return null;

  if (error || !data) {
    return (
      <LoadError
        message={t('banking.transaction.notFound')}
        link={{ to: '/app/money/transactions', label: t('banking.journal.title') }}
      />
    );
  }

  const { transaction, allocations } = data;
  const isOut = transaction.direction === 'out';
  const hasCounterpart = Boolean(transaction.transfer_counterpart);
  const account = (accountsQuery.data ?? []).find((a) => a.id === transaction.account);
  const remaining = Number(data.remaining);

  return (
    <>
      <PageHeader
        backLink={
          <BackLink fallback="/app/money/transactions" fallbackLabel={t('banking.journal.title')} />
        }
        title={transaction.label_raw}
        titleSuffix={
          <Badge variant={isOut ? 'destructive' : 'secondary'}>
            {t(`banking.transaction.direction.${transaction.direction}`)}
          </Badge>
        }
        description={`${formatDate(transaction.booked_on)}${
          account ? ` · ${account.name}` : ''
        }`}
      >
        {isOut && !hasCounterpart ? (
          <Button
            type="button"
            variant="outline"
            className="h-8 px-3 text-sm"
            onClick={() => setAllocateOpen(true)}
          >
            <PieChart className="mr-1.5 h-3.5 w-3.5" />
            {t('banking.allocation.action')}
          </Button>
        ) : null}
      </PageHeader>

      <div className="space-y-6">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoField label={t('banking.transaction.amount')}>
            <span
              className={`text-base font-semibold tabular-nums ${
                transaction.is_internal
                  ? 'text-muted-foreground'
                  : isOut
                    ? 'text-destructive'
                    : 'text-primary'
              }`}
            >
              {formatAmount(transaction.amount)}
            </span>
          </InfoField>

          <InfoField label={t('banking.transaction.bookedOn')}>
            {formatDate(transaction.booked_on)}
          </InfoField>

          {transaction.value_on ? (
            <InfoField label={t('banking.transaction.valueOn')}>
              {formatDate(transaction.value_on)}
            </InfoField>
          ) : null}

          {account ? (
            <InfoField label={t('banking.transaction.account')}>{account.name}</InfoField>
          ) : null}

          {/* Le solde n'est jamais dénormalisé ; celui-ci est le solde **imprimé
              par la banque** sur cette ligne — l'ancre de toute la chaîne. */}
          {transaction.balance_after ? (
            <InfoField label={t('banking.transaction.balanceAfter')}>
              {formatAmount(transaction.balance_after)}
            </InfoField>
          ) : null}

          {transaction.external_id ? (
            <InfoField label={t('banking.transaction.reference')}>
              <span className="break-all font-mono text-xs">{transaction.external_id}</span>
            </InfoField>
          ) : null}
        </dl>

        <div className="flex flex-wrap gap-1.5">
          {transaction.is_internal ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {hasCounterpart ? (
                <Banknote className="h-3 w-3" aria-hidden />
              ) : (
                <Repeat className="h-3 w-3" aria-hidden />
              )}
              {hasCounterpart ? t('banking.withdraw.linkedBadge') : t('banking.journal.internal')}
            </span>
          ) : null}
          {!isOut && !transaction.is_internal ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                transaction.inflow_nature
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {transaction.inflow_nature
                ? t(`banking.inflow.natures.${transaction.inflow_nature}`)
                : t('banking.inflow.unclassified')}
            </span>
          ) : null}
        </div>

        {transaction.notes ? (
          <Card className="p-3">
            <p className="text-sm italic text-muted-foreground">{transaction.notes}</p>
          </Card>
        ) : null}

        {isOut && !hasCounterpart ? (
          <section className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">
                {t('banking.transaction.allocationsTitle')}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t('banking.transaction.allocatedOf', {
                  allocated: formatAmount(data.allocated),
                  total: formatAmount(Math.abs(Number(transaction.amount))),
                })}
              </p>
            </div>

            {allocations.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">
                {t('banking.transaction.noAllocation')}
              </p>
            ) : (
              <ul className="space-y-2">
                {allocations.map((expense) => (
                  <AllocationLine key={expense.id} expense={expense} />
                ))}
              </ul>
            )}

            {remaining > 0 ? (
              <p className="text-xs text-destructive">
                {t('banking.transaction.remaining', { amount: formatAmount(data.remaining) })}
              </p>
            ) : null}
          </section>
        ) : null}
      </div>

      {allocateOpen ? (
        <AllocationDialog
          open
          onOpenChange={(next) => !next && setAllocateOpen(false)}
          transactionId={transaction.id}
        />
      ) : null}
    </>
  );
}

/** Une dépense que cette opération justifie — avec par où elle compte. */
function AllocationLine({ expense }: { expense: AllocatedExpense }) {
  const { t } = useTranslation();
  const location = useLocation();
  const meta = [expense.budget?.name, expense.source_label].filter(Boolean).join(' · ');

  return (
    <li>
      <Card className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link
              to={`/app/money/expenses/${expense.id}`}
              state={pushBack(location)}
              className="group text-foreground hover:text-primary"
            >
              <CardTitle className="text-inherit [&>span:last-child]:group-hover:underline">
                {expense.subject}
              </CardTitle>
            </Link>
            {meta ? <p className="mt-1 text-xs text-muted-foreground">{meta}</p> : null}
          </div>
          <p className="shrink-0 text-sm font-semibold tabular-nums">
            {expense.amount ? formatAmount(expense.amount) : t('expenses.list.noAmount')}
          </p>
        </div>
      </Card>
    </li>
  );
}
