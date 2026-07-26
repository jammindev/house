import * as React from 'react';
import { Landmark, Plus, Receipt } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import EmptyState from '@/components/EmptyState';
import { Button, buttonVariants } from '@/design-system/button';
import { FilterPill } from '@/design-system/filter-pill';
import { pushBack } from '@/lib/backNavigation';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useSessionState } from '@/lib/useSessionState';
import type { BankAccount } from '@/lib/api/banking';
import {
  useArchiveBankAccount,
  useBankAccounts,
  useRestoreBankAccount,
  useStatementImports,
} from '@/features/banking/hooks';
import AccountCard from '@/features/banking/AccountCard';
import AccountDialog from '@/features/banking/AccountDialog';
import ImportHistoryCard from '@/features/banking/ImportHistoryCard';
import StatementImportDialog from '@/features/banking/StatementImportDialog';

/**
 * Onglet « Comptes » du module Argent (parcours 26, lot 2).
 *
 * Anciennement `banking/BankingPage`. Le contenu est inchangé : seul le
 * `PageHeader` disparaît, la coque `MoneyPage` portant désormais le titre. Les
 * actions restent dans le panneau — elles connaissent l'état d'édition local
 * (compte courant, import en cours), qu'il aurait fallu remonter sans raison.
 */
export default function AccountsPanel() {
  const { t } = useTranslation();
  const location = useLocation();
  const [showArchived, setShowArchived] = useSessionState('banking.showArchived', false);
  const accountsQuery = useBankAccounts(showArchived);
  const archiveMutation = useArchiveBankAccount();
  const restoreMutation = useRestoreBankAccount();

  const importsQuery = useStatementImports();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<BankAccount | undefined>(undefined);
  const [importing, setImporting] = React.useState<BankAccount | null>(null);
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
      <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
        <div className="flex flex-wrap gap-1.5">
          <FilterPill active={!showArchived} onClick={() => setShowArchived(false)}>
            {t('banking.filters.active')}
          </FilterPill>
          <FilterPill active={showArchived} onClick={() => setShowArchived(true)}>
            {t('banking.filters.all')}
          </FilterPill>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/app/money/transactions"
            state={pushBack(location)}
            className={buttonVariants({ variant: 'outline' })}
          >
            <Receipt className="mr-1.5 h-4 w-4" aria-hidden />
            {t('banking.journal.title')}
          </Link>
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            {t('banking.new.action')}
          </Button>
        </div>
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
              onImport={() => setImporting(account)}
            />
          ))}
        </div>
      )}

      {importsQuery.data && importsQuery.data.length > 0 ? (
        <div className="mt-6">
          <ImportHistoryCard imports={importsQuery.data} />
        </div>
      ) : null}

      <AccountDialog open={dialogOpen} onOpenChange={setDialogOpen} existing={editing} />

      {importing ? (
        <StatementImportDialog
          open
          onOpenChange={(next) => !next && setImporting(null)}
          account={importing}
        />
      ) : null}
    </>
  );
}
