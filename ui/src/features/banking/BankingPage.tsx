import * as React from 'react';
import { Landmark, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/design-system/button';
import { FilterPill } from '@/design-system/filter-pill';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useSessionState } from '@/lib/useSessionState';
import type { BankAccount } from '@/lib/api/banking';
import { useArchiveBankAccount, useBankAccounts, useRestoreBankAccount } from './hooks';
import AccountCard from './AccountCard';
import AccountDialog from './AccountDialog';

export default function BankingPage() {
  const { t } = useTranslation();
  const [showArchived, setShowArchived] = useSessionState('banking.showArchived', false);
  const accountsQuery = useBankAccounts(showArchived);
  const archiveMutation = useArchiveBankAccount();
  const restoreMutation = useRestoreBankAccount();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<BankAccount | undefined>(undefined);
  const [pendingArchive, setPendingArchive] = React.useState<Set<string>>(new Set());

  const { deleteWithUndo } = useDeleteWithUndo({
    label: t('banking.archived'),
    onDelete: (id) => archiveMutation.mutateAsync(id),
  });

  const showSkeleton = useDelayedLoading(accountsQuery.isLoading);

  function openCreate() {
    setEditing(undefined);
    setDialogOpen(true);
  }

  function openEdit(account: BankAccount) {
    setEditing(account);
    setDialogOpen(true);
  }

  function handleArchive(id: string) {
    deleteWithUndo(id, {
      onRemove: () => setPendingArchive((prev) => new Set(prev).add(id)),
      onRestore: () =>
        setPendingArchive((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        }),
    });
  }

  const accounts = (accountsQuery.data ?? []).filter((a) => !pendingArchive.has(a.id));

  return (
    <>
      <PageHeader title={t('banking.title')} description={t('banking.subtitle')}>
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          {t('banking.new.action')}
        </Button>
      </PageHeader>

      <div className="flex flex-wrap gap-1.5 pb-4">
        <FilterPill active={!showArchived} onClick={() => setShowArchived(false)}>
          {t('banking.filters.active')}
        </FilterPill>
        <FilterPill active={showArchived} onClick={() => setShowArchived(true)}>
          {t('banking.filters.all')}
        </FilterPill>
      </div>

      {showSkeleton ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title={t('banking.empty.title')}
          description={t('banking.empty.description')}
          action={{ label: t('banking.new.action'), onClick: openCreate }}
        />
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onEdit={() => openEdit(account)}
              onArchive={() => handleArchive(account.id)}
              onRestore={() => restoreMutation.mutate(account.id)}
            />
          ))}
        </div>
      )}

      <AccountDialog open={dialogOpen} onOpenChange={setDialogOpen} existing={editing} />
    </>
  );
}
