import * as React from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/PageHeader';
import BackLink from '@/components/BackLink';
import { Button } from '@/design-system/button';
import { SheetDialog } from '@/design-system/sheet-dialog';
import { FormField } from '@/design-system/form-field';
import { Textarea } from '@/design-system/textarea';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useSessionState } from '@/lib/useSessionState';
import type { BankTransaction, TransactionFilters as Filters } from '@/lib/api/banking';
import {
  useAccountFlow,
  useBankAccounts,
  useQualifyTransaction,
  useTransactions,
  useReconcile,
  useUnlinkCashCounterpart,
} from './hooks';
import FlowSummaryCards from './FlowSummaryCards';
import TransactionFilters from './TransactionFilters';
import TransactionList from './TransactionList';
import WithdrawToCashDialog from './WithdrawToCashDialog';
import AllocationDialog from './AllocationDialog';
import SuggestionsDialog from './SuggestionsDialog';

const PAGE_SIZE = 50;
const NO_FILTERS: Filters = {};

export default function TransactionsPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useSessionState<Filters>('banking.journal.filters', NO_FILTERS);

  const accountsQuery = useBankAccounts();
  const transactionsQuery = useTransactions(filters, PAGE_SIZE);
  const flowQuery = useAccountFlow(filters);
  const qualifyMutation = useQualifyTransaction();
  const unlinkCashMutation = useUnlinkCashCounterpart();

  const [noteTarget, setNoteTarget] = React.useState<BankTransaction | null>(null);
  const [noteDraft, setNoteDraft] = React.useState('');
  const [cashTarget, setCashTarget] = React.useState<BankTransaction | null>(null);
  const [allocationTarget, setAllocationTarget] = React.useState<BankTransaction | null>(null);
  const [suggestTarget, setSuggestTarget] = React.useState<BankTransaction | null>(null);
  const reconcileMutation = useReconcile();

  const cashAccounts = (accountsQuery.data ?? []).filter((a) => a.kind === 'cash');

  const showSkeleton = useDelayedLoading(transactionsQuery.isLoading);

  function toggleInternal(transaction: BankTransaction) {
    qualifyMutation.mutate({
      id: transaction.id,
      payload: { is_internal: !transaction.is_internal },
    });
  }

  function openNote(transaction: BankTransaction) {
    setNoteTarget(transaction);
    setNoteDraft(transaction.notes);
  }

  function saveNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteTarget) return;
    qualifyMutation.mutate({ id: noteTarget.id, payload: { notes: noteDraft } });
    setNoteTarget(null);
  }

  const page = transactionsQuery.data;

  return (
    <>
      <PageHeader
        title={t('banking.journal.title')}
        description={t('banking.journal.subtitle')}
        backLink={<BackLink fallback="/app/banking" fallbackLabel={t('banking.title')} />}
      >
        <Button
          variant="outline"
          onClick={() => reconcileMutation.mutate({})}
          disabled={reconcileMutation.isPending}
        >
          <Sparkles className="mr-1.5 h-4 w-4" aria-hidden />
          {t('banking.reconcile.runAll')}
        </Button>
      </PageHeader>

      {flowQuery.data ? (
        <div className="pb-4">
          <FlowSummaryCards flow={flowQuery.data} />
        </div>
      ) : null}

      <TransactionFilters
        filters={filters}
        accounts={accountsQuery.data ?? []}
        onChange={setFilters}
      />

      {showSkeleton ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <TransactionList
          transactions={page?.results ?? []}
          total={page?.count ?? 0}
          canFeedCash={cashAccounts.length > 0}
          onToggleInternal={toggleInternal}
          onEditNote={openNote}
          onFeedCash={setCashTarget}
          onUnlinkCash={(transaction) => unlinkCashMutation.mutate(transaction.id)}
          onAllocate={setAllocationTarget}
          onSuggest={setSuggestTarget}
        />
      )}

      {suggestTarget ? (
        <SuggestionsDialog
          open
          onOpenChange={(next) => !next && setSuggestTarget(null)}
          transaction={suggestTarget}
        />
      ) : null}

      {allocationTarget ? (
        <AllocationDialog
          open
          onOpenChange={(next) => !next && setAllocationTarget(null)}
          transaction={allocationTarget}
        />
      ) : null}

      {cashTarget ? (
        <WithdrawToCashDialog
          open
          onOpenChange={(next) => !next && setCashTarget(null)}
          transaction={cashTarget}
          cashAccounts={cashAccounts}
        />
      ) : null}

      <SheetDialog
        open={noteTarget !== null}
        onOpenChange={(next) => !next && setNoteTarget(null)}
        title={t('banking.journal.editNote')}
      >
        <form onSubmit={saveNote} className="mt-4 space-y-4">
          {noteTarget ? (
            <p className="text-sm text-muted-foreground">{noteTarget.label_raw}</p>
          ) : null}

          <FormField label={t('banking.journal.note')} htmlFor="transaction-note">
            <Textarea
              id="transaction-note"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={3}
              autoFocus
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setNoteTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={qualifyMutation.isPending}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </SheetDialog>
    </>
  );
}
