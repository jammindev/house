import * as React from 'react';
import { Banknote, Landmark, Plus, Receipt } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import EmptyState from '@/components/EmptyState';
import BalanceLineChart from '@/components/charts/BalanceLineChart';
import { Button, buttonVariants } from '@/design-system/button';
import { Card } from '@/design-system/card';
import { FilterPill } from '@/design-system/filter-pill';
import { pushBack } from '@/lib/backNavigation';
import { chartColor } from '@/lib/chartColors';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { useDeleteWithUndo } from '@/lib/useDeleteWithUndo';
import { useSessionState } from '@/lib/useSessionState';
import type { BankAccount } from '@/lib/api/banking';
import {
  useArchiveBankAccount,
  useBankAccounts,
  useHouseholdBalanceHistory,
  useRestoreBankAccount,
  useStatementImports,
} from '@/features/banking/hooks';
import AccountCard from '@/features/banking/AccountCard';
import BalanceAnchorDialog from '@/features/banking/BalanceAnchorDialog';
import AccountDialog from '@/features/banking/AccountDialog';
import ImportHistoryCard from '@/features/banking/ImportHistoryCard';
import StatementImportDialog from '@/features/banking/StatementImportDialog';
import CashDepositDialog from './CashDepositDialog';
import {
  BalanceWindowPills,
  DEFAULT_BALANCE_WINDOW,
  type BalanceWindow,
} from './balanceWindow';

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
  const [anchoring, setAnchoring] = React.useState<BankAccount | null>(null);
  const [depositOpen, setDepositOpen] = React.useState(false);
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
          {/* Une rentrée d'espèces se saisit ici et pas dans l'onglet Dépenses :
              ce n'est pas une dépense, c'est de l'argent qui arrive dans une
              caisse — donc un geste de compte. */}
          <Button variant="outline" onClick={() => setDepositOpen(true)}>
            <Banknote className="mr-1.5 h-4 w-4" aria-hidden />
            {t('banking.deposit.action')}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            {t('banking.new.action')}
          </Button>
        </div>
      </div>

      {/* Au-dessus des cartes : la même question posée sur tout le foyer. Une
          carte par compte dit « combien, chacun » ; seule la courbe dit si
          l'ensemble monte ou descend, et depuis quand. */}
      {!showSkeleton && accounts.length > 0 ? <HouseholdBalanceCard /> : null}

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
              onFindBalance={() => setAnchoring(account)}
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

      <CashDepositDialog open={depositOpen} onOpenChange={setDepositOpen} />

      {importing ? (
        <StatementImportDialog
          open
          onOpenChange={(next) => !next && setImporting(null)}
          account={importing}
        />
      ) : null}

      {anchoring ? (
        <BalanceAnchorDialog
          open
          onOpenChange={(next) => !next && setAnchoring(null)}
          account={anchoring}
        />
      ) : null}
    </>
  );
}

/**
 * Ce que le foyer détient, dans le temps — total en tête, un trait fin par compte.
 *
 * Le total est la série qu'on vient lire ; les comptes sont là pour répondre
 * « lequel a bougé ». D'où le trait épais sur l'un et fin sur les autres, plutôt
 * que cinq lignes d'égale importance dans lesquelles la somme se perd.
 *
 * ⚠️ Avant son ouverture, un compte compte pour **zéro** dans le total, jamais
 * pour son solde d'ouverture projeté en arrière : le total est le seul chiffre
 * de cet écran sur lequel quelqu'un pourrait agir (`banking.history`).
 *
 * Les séries viennent du serveur sur un **axe commun** — deux courbes
 * échantillonnées séparément ne se lisent pas l'une contre l'autre, et ne
 * s'additionnent pas.
 */
function HouseholdBalanceCard() {
  const { t } = useTranslation();
  const [months, setMonths] = useSessionState<BalanceWindow>(
    'banking.history.window',
    DEFAULT_BALANCE_WINDOW,
  );
  const historyQuery = useHouseholdBalanceHistory({ months });
  const history = historyQuery.data;

  const series = React.useMemo(() => {
    if (!history) return [];
    return [
      {
        key: 'total',
        label: t('banking.history.total'),
        color: 'hsl(var(--foreground))',
        emphasis: true,
        points: history.total,
      },
      // La couleur suit le compte, pas son rang d'affichage : le serveur trie
      // par nom, donc l'index est stable d'un rendu à l'autre.
      ...history.accounts.map((account, index) => ({
        key: account.account_id,
        label: account.name,
        color: chartColor(index),
        points: account.points,
      })),
    ];
  }, [history, t]);

  if (historyQuery.isLoading) {
    return <div className="mb-4 h-72 w-full animate-pulse rounded-lg bg-muted sm:h-80" />;
  }
  // Un seul point ne fait pas une évolution — mieux vaut ne rien montrer que
  // montrer un plat qui se lirait comme « rien n'a bougé ».
  if (!history || history.total.length < 2) return null;

  return (
    <Card className="mb-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('banking.history.householdTitle')}
        </p>
        <BalanceWindowPills value={months} onChange={setMonths} />
      </div>
      <BalanceLineChart series={series} unreliable={!history.is_reliable} />
    </Card>
  );
}
