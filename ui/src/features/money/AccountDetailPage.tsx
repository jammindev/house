import * as React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArchiveRestore,
  Banknote,
  CalendarRange,
  CheckCircle2,
  Landmark,
  Pencil,
  Receipt,
  Scale,
  Trash2,
  Upload,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import BackLink from '@/components/BackLink';
import InfoField from '@/components/InfoField';
import LoadError from '@/components/LoadError';
import ListSkeleton from '@/components/ListSkeleton';
import { Badge } from '@/design-system/badge';
import { Button, buttonVariants } from '@/design-system/button';
import { Card } from '@/design-system/card';
import { pushBack, useNavigateBack } from '@/lib/backNavigation';
import { useDelayedLoading } from '@/lib/useDelayedLoading';
import { formatAmount, formatDate } from '@/lib/format';
import type { AccountCoverage, BankAccount, BankTransaction } from '@/lib/api/banking';
import {
  useAccountBalance,
  useAccountCoverage,
  useAccountFlow,
  useArchiveBankAccount,
  useBankAccounts,
  useRestoreBankAccount,
  useStatementImports,
  useTransactions,
} from '@/features/banking/hooks';
import AccountDialog from '@/features/banking/AccountDialog';
import BalanceAnchorDialog from '@/features/banking/BalanceAnchorDialog';
import ChainGapAlert from '@/features/banking/ChainGapAlert';
import ImportHistoryCard from '@/features/banking/ImportHistoryCard';
import StatementImportDialog from '@/features/banking/StatementImportDialog';
import CashExpenseDialog from './CashExpenseDialog';

/** Combien d'opérations récentes montrer avant de renvoyer au journal. */
const RECENT_LIMIT = 5;

/**
 * La fiche d'un compte (`/app/money/accounts/:id`).
 *
 * L'onglet Comptes tient dans une carte par compte : un nom, un solde, un menu.
 * C'est le bon format pour choisir, et le mauvais pour comprendre — toutes les
 * questions qu'on pose ensuite se posent *sur un compte* et n'avaient nulle part
 * où être répondues :
 *
 * 1. **Combien, et est-ce fiable ?** Le solde, sa provenance (lu sur le relevé ou
 *    recalculé), et les ruptures de chaîne qui le rendent incertain.
 * 2. **Sur quoi le contrôle porte-t-il ?** La fenêtre de conformité du compte —
 *    ⚠️ avec sa **raison** quand il n'y en a pas. Un compte sans fenêtre n'est
 *    jamais « conforme », il est *non évaluable*, et les trois causes ne se valent
 *    pas : rien d'importé est normal, une date de solde postérieure aux relevés
 *    rend le compte invisible à tous les contrôles.
 * 3. **Qu'ai-je importé, et qu'est-ce que ça a rangé ?** L'historique complet des
 *    dépôts pour ce compte — période couverte, lignes créées, lignes ignorées,
 *    lignes rapprochées d'elles-mêmes — plus les périodes qu'aucun relevé n'a
 *    jamais couvertes.
 * 4. **Que me reste-t-il à faire ici ?** Les opérations que le Contrôle réclame
 *    sur ce compte, comptées par le **même** filtre serveur que la file « À
 *    ranger » (`allocation=todo`) : deux voix sur le même chiffre, et plus
 *    personne n'en croit aucune.
 *
 * Les totaux de flux sont la vue « banque », jamais additionnés aux budgets : le
 * pont reste le taux de couverture (CLAUDE.md « Relevés bancaires »).
 */
export default function AccountDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const location = useLocation();
  const navigateBack = useNavigateBack('/app/money?tab=accounts');

  const [editOpen, setEditOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [anchorOpen, setAnchorOpen] = React.useState(false);
  const [cashOpen, setCashOpen] = React.useState(false);

  // Les archivés inclus : on doit pouvoir ouvrir la fiche d'un compte clos, ne
  // serait-ce que pour le rouvrir.
  const accountsQuery = useBankAccounts(true);
  const account = (accountsQuery.data ?? []).find((row) => row.id === id);

  const archiveMutation = useArchiveBankAccount();
  const restoreMutation = useRestoreBankAccount();

  // Un compte archivé n'a plus de solde à surveiller — même arbitrage que la carte.
  const balanceQuery = useAccountBalance(account && !account.archived ? id : undefined);
  const coverageQuery = useAccountCoverage(id);
  const flowQuery = useAccountFlow(React.useMemo(() => ({ account: id }), [id]));
  const importsQuery = useStatementImports(id);
  // `limit: 1` : on ne veut que le `count`. Le filtre `allocation=todo` passe par
  // `detectors.pending_outflows`, donc par le même jugement que le badge Contrôle.
  const pendingQuery = useTransactions(
    React.useMemo(() => ({ account: id, allocation: 'todo' as const }), [id]),
    1,
  );
  const recentQuery = useTransactions(React.useMemo(() => ({ account: id }), [id]), RECENT_LIMIT);

  const showSkeleton = useDelayedLoading(accountsQuery.isLoading);

  if (!id) return null;
  if (showSkeleton) return <ListSkeleton className="space-y-2 p-4" />;
  if (accountsQuery.isLoading) return null;

  if (accountsQuery.error || !account) {
    return (
      <LoadError
        message={t('banking.account.notFound')}
        link={{ to: '/app/money?tab=accounts', label: t('money.tabs.accounts') }}
      />
    );
  }

  const isCash = account.kind === 'cash';
  const Icon = isCash ? Banknote : Landmark;
  const balance = balanceQuery.data;
  const flow = flowQuery.data;
  const pendingCount = pendingQuery.data?.count ?? 0;
  const recent = recentQuery.data?.results ?? [];
  const details = [account.bank_label, account.iban_last4 ? `••••${account.iban_last4}` : '']
    .filter(Boolean)
    .join(' · ');

  /**
   * Archiver ferme la fiche. Pas d'undo différé ici, contrairement à la liste :
   * archiver n'est pas une suppression — rien n'est détruit, la fiche reste
   * accessible, et son propre bouton « Rouvrir » est le chemin de retour.
   */
  const archive = () => archiveMutation.mutate(id, { onSuccess: () => navigateBack() });

  return (
    <>
      <PageHeader
        backLink={
          <BackLink fallback="/app/money?tab=accounts" fallbackLabel={t('money.tabs.accounts')} />
        }
        title={
          <span className="flex items-center gap-2">
            <span className="rounded-lg bg-primary/10 p-1.5 text-primary">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            {account.name}
          </span>
        }
        documentTitle={account.name}
        titleSuffix={
          account.archived ? (
            <Badge variant="outline">{t('banking.archived')}</Badge>
          ) : (
            <Badge variant="secondary">{t(`banking.kinds.${account.kind}`)}</Badge>
          )
        }
        description={details || t(`banking.kinds.${account.kind}`)}
      >
        {account.archived ? (
          <Button
            type="button"
            variant="outline"
            className="h-8 px-3 text-sm"
            onClick={() => restoreMutation.mutate(account.id)}
          >
            <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
            {t('banking.reopen')}
          </Button>
        ) : (
          <>
            {isCash ? (
              <Button
                type="button"
                variant="outline"
                className="h-8 px-3 text-sm"
                onClick={() => setCashOpen(true)}
              >
                <Banknote className="mr-1.5 h-3.5 w-3.5" />
                {t('banking.cash.title')}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-8 px-3 text-sm"
                onClick={() => setImportOpen(true)}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                {t('banking.import.action')}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="h-8 px-3 text-sm"
              onClick={() => setAnchorOpen(true)}
            >
              <Scale className="mr-1.5 h-3.5 w-3.5" />
              {t('banking.anchor.action')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8 px-3 text-sm"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              {t('common.edit')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8 px-3 text-sm text-destructive hover:text-destructive"
              onClick={archive}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {t('banking.archive')}
            </Button>
          </>
        )}
      </PageHeader>

      <div className="space-y-6">
        {account.archived ? (
          <Card className="p-3">
            <p className="text-sm text-muted-foreground">{t('banking.account.archivedHint')}</p>
          </Card>
        ) : null}

        {/* 1. Le solde — le chiffre qu'on vient lire, avec ce qu'il vaut. */}
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('banking.account.balanceTitle')}
          </p>
          {balanceQuery.isLoading ? (
            <div className="mt-2 h-9 w-40 animate-pulse rounded bg-muted" />
          ) : balance ? (
            <>
              <p
                className={`mt-1 text-3xl font-semibold tabular-nums ${
                  Number(balance.amount) < 0 ? 'text-destructive' : 'text-foreground'
                }`}
              >
                {formatAmount(balance.amount)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(`banking.account.balanceSource.${balance.source}`)}
                {balance.as_of
                  ? ` · ${t('banking.account.balanceAsOf', { date: formatDate(balance.as_of) })}`
                  : ''}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {t('banking.account.balanceUnavailable')}
            </p>
          )}

          {balance ? (
            <div className="mt-3">
              <ChainGapAlert balance={balance} accountName={account.name} />
            </div>
          ) : null}
        </Card>

        {/* 2. Ce sur quoi le contrôle porte — jamais une coche verte muette. */}
        <CoverageSection
          account={account}
          coverage={coverageQuery.data}
          onFixOpeningDate={() => setEditOpen(true)}
        />

        {/* 3. Le pont banque ↔ dépenses : un ratio, jamais une somme. */}
        {flow ? (
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">
              {t('banking.account.flowTitle')}
            </h2>
            <div className="grid gap-2 sm:grid-cols-3">
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">{t('banking.journal.outflow')}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                  {formatAmount(flow.outflow)}
                </p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">{t('banking.journal.inflow')}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                  {formatAmount(flow.inflow)}
                </p>
              </Card>
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">{t('expenses.summary.coverage')}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
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
              </Card>
            </div>
            <p className="text-xs text-muted-foreground">{t('banking.account.flowHint')}</p>
          </section>
        ) : null}

        {/* 4. Ce qu'il reste à faire ici, compté par le filtre du Contrôle. */}
        <Card className="p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm text-foreground">
              {pendingCount > 0 ? (
                <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              )}
              {pendingCount > 0
                ? t('banking.account.pendingCount', { count: pendingCount })
                : t('banking.account.pendingNone')}
            </p>
            {pendingCount > 0 ? (
              <Link
                to={`/app/money/transactions?account=${account.id}&allocation=todo`}
                state={pushBack(location)}
                className={buttonVariants({ variant: 'outline', className: 'h-8 px-3 text-sm' })}
              >
                {t('banking.account.pendingAction')}
              </Link>
            ) : null}
          </div>
        </Card>

        {/* 5. Les dernières opérations — un aperçu, pas un second journal. */}
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">
              {t('banking.account.recentTitle')}
            </h2>
            <Link
              to={`/app/money/transactions?account=${account.id}`}
              state={pushBack(location)}
              className="text-sm text-primary hover:underline"
            >
              {t('banking.account.seeAll')}
            </Link>
          </div>

          {recent.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">
              {t('banking.account.noOperations')}
            </p>
          ) : (
            <ul className="space-y-2">
              {recent.map((line) => (
                <RecentLine key={line.id} line={line} />
              ))}
            </ul>
          )}
        </section>

        {/* 6. Les imports : la seule trace qui explique ce que le compte contient. */}
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-base font-semibold text-foreground">
              <Receipt className="h-4 w-4 text-muted-foreground" aria-hidden />
              {t('banking.import.history')}
            </h2>
            {!isCash && !account.archived ? (
              <Button
                type="button"
                variant="outline"
                className="h-8 px-3 text-sm"
                onClick={() => setImportOpen(true)}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                {t('banking.import.action')}
              </Button>
            ) : null}
          </div>

          {(importsQuery.data ?? []).length === 0 ? (
            <p className="text-sm italic text-muted-foreground">
              {t(isCash ? 'banking.account.noImportsCash' : 'banking.account.noImports')}
            </p>
          ) : (
            <ImportHistoryCard imports={importsQuery.data ?? []} hideAccount limit={20} />
          )}
        </section>

        {/* 7. La fiche brute en dernier : elle précise, elle ne se lit pas d'abord. */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">
            {t('banking.account.detailsTitle')}
          </h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoField label={t('banking.fields.openingBalance')}>
              {account.opening_balance_date ? (
                <span className="tabular-nums">
                  {t('banking.openingBalanceOn', {
                    amount: formatAmount(account.opening_balance),
                    date: formatDate(account.opening_balance_date),
                  })}
                </span>
              ) : (
                <span className="text-warning">{t('banking.noOpeningBalance')}</span>
              )}
            </InfoField>

            {/* La saisie dont le solde d'ouverture a été *dérivé* : gardée pour que
                la soustraction reste re-vérifiable (parcours 26, lot 8). */}
            {account.attested_on ? (
              <InfoField label={t('banking.anchor.balanceLabel')}>
                <span className="tabular-nums">
                  {t('banking.anchor.attestedOn', {
                    amount: formatAmount(account.attested_balance ?? '0'),
                    date: formatDate(account.attested_on),
                  })}
                </span>
              </InfoField>
            ) : null}

            <InfoField label={t('banking.account.transactionsLabel')}>
              {t('banking.account.transactionCount', {
                count: coverageQuery.data?.transaction_count ?? 0,
              })}
            </InfoField>

            {account.bank_label ? (
              <InfoField label={t('banking.fields.bankLabel')}>{account.bank_label}</InfoField>
            ) : null}

            {account.iban_last4 ? (
              <InfoField label={t('banking.fields.ibanLast4')}>
                <span className="font-mono">••••{account.iban_last4}</span>
              </InfoField>
            ) : null}

            <InfoField label={t('banking.account.currencyLabel')}>{account.currency}</InfoField>
          </dl>
        </section>
      </div>

      <AccountDialog open={editOpen} onOpenChange={setEditOpen} existing={account} />

      {importOpen ? (
        <StatementImportDialog
          open
          onOpenChange={(next) => !next && setImportOpen(false)}
          account={account}
        />
      ) : null}

      {anchorOpen ? (
        <BalanceAnchorDialog
          open
          onOpenChange={(next) => !next && setAnchorOpen(false)}
          account={account}
        />
      ) : null}

      <CashExpenseDialog open={cashOpen} onOpenChange={setCashOpen} />
    </>
  );
}

/**
 * La période sur laquelle le contrôle porte — ou la raison pour laquelle il ne
 * porte sur rien.
 *
 * ⚠️ Ne jamais rendre les trois `status` d'échec de la même façon. `no_data` est
 * normal (rien d'importé), les deux autres rendent le compte muet pour **tous** les
 * détecteurs, et l'un des deux ressemble à un compte correctement réglé : c'est
 * exactement la confusion qui a fait afficher « tout est affecté » sur un compte
 * dont pas une ligne n'était vérifiée.
 */
function CoverageSection({
  account,
  coverage,
  onFixOpeningDate,
}: {
  account: BankAccount;
  coverage: AccountCoverage | undefined;
  onFixOpeningDate: () => void;
}) {
  const { t } = useTranslation();

  if (!coverage) return null;

  const covered = coverage.status === '';

  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-1.5 text-base font-semibold text-foreground">
        <CalendarRange className="h-4 w-4 text-muted-foreground" aria-hidden />
        {t('banking.account.coverageTitle')}
      </h2>

      <Card
        className={`p-3 ${
          covered || coverage.status === 'no_data' ? '' : 'border-warning/40 bg-warning/10'
        }`}
      >
        {covered ? (
          <>
            <p className="text-sm font-medium text-foreground">
              {t('banking.account.coverageWindow', {
                from: formatDate(coverage.start),
                to: formatDate(coverage.end),
              })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('banking.account.coverageHint')}
            </p>
          </>
        ) : (
          <>
            <p className="flex items-start gap-2 text-sm font-medium text-foreground">
              <AlertTriangle
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  coverage.status === 'no_data' ? 'text-muted-foreground' : 'text-warning'
                }`}
                aria-hidden
              />
              {t(`banking.account.coverageNone.${coverage.status}`, {
                openingDate: formatDate(account.opening_balance_date),
                earliestLine: formatDate(coverage.first_line),
              })}
            </p>
            {coverage.status !== 'no_data' ? (
              <Button
                type="button"
                variant="outline"
                className="mt-2 h-7 px-2 text-xs"
                onClick={onFixOpeningDate}
              >
                {t('money.compliance.fix')}
              </Button>
            ) : null}
          </>
        )}

        {/* Les périodes qu'aucun relevé n'a jamais couvertes. Le contrôle de chaîne
            ne peut pas les voir : rien n'a été importé, donc aucune arithmétique de
            soldes n'en garde la trace. */}
        {coverage.gaps.length > 0 ? (
          <div className="mt-3 border-t border-border/60 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('banking.account.gapsTitle')}
            </p>
            <ul className="mt-1.5 space-y-1">
              {coverage.gaps.map((gap) => (
                <li key={gap.gap_start} className="text-xs text-warning">
                  {t('banking.account.coverageGap', {
                    from: formatDate(gap.gap_start),
                    to: formatDate(gap.gap_end),
                    count: gap.days,
                  })}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
    </section>
  );
}

/** Une opération de l'aperçu — le montant signé, et le lien vers la ligne. */
function RecentLine({ line }: { line: BankTransaction }) {
  const { t } = useTranslation();
  const location = useLocation();
  const isOut = line.direction === 'out';

  return (
    <li>
      <Card className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link
              to={`/app/money/transactions/${line.id}`}
              state={pushBack(location)}
              className="truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
            >
              {line.label_raw}
            </Link>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDate(line.booked_on)}
              {line.is_internal ? ` · ${t('banking.journal.internal')}` : ''}
            </p>
          </div>
          <p
            className={`shrink-0 text-sm font-semibold tabular-nums ${
              line.is_internal
                ? 'text-muted-foreground'
                : isOut
                  ? 'text-destructive'
                  : 'text-primary'
            }`}
          >
            {formatAmount(line.amount)}
          </p>
        </div>
      </Card>
    </li>
  );
}
