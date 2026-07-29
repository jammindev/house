import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  archiveBankAccount,
  createBankAccount,
  fetchAccountBalance,
  fetchAccountBalanceHistory,
  fetchAccountCoverage,
  fetchAllocations,
  fetchAccountFlow,
  fetchBalanceAnchor,
  fetchHouseholdBalanceHistory,
  adjustCashMirror,
  fetchBankAccounts,
  fetchStatementImports,
  fetchSuggestions,
  fetchTransactions,
  importStatementFile,
  linkInteraction,
  previewStatementFile,
  qualifyTransaction,
  reconcileTransactions,
  recordCashDeposit,
  recordCashExpense,
  restoreBankAccount,
  setAllocations,
  setRefundAllocations,
  type RefundAllocationLine,
  setBalanceAnchor,
  unlinkAllocation,
  unlinkCashCounterpart,
  updateBankAccount,
  withdrawToCash,
  type AllocationLine,
  type BalanceHistoryParams,
  type BankAccountPayload,
  type CashDepositPayload,
  type CashExpensePayload,
  type InflowNature,
  type StatementMapping,
  type TransactionFilters,
} from '@/lib/api/banking';
import { toast } from '@/lib/toast';
import { BANKING_ROOT } from '@/features/money/keys';
import { useInvalidateMoney } from '@/features/money/invalidate';

export const bankingKeys = {
  all: BANKING_ROOT,
  accounts: (includeArchived: boolean) =>
    [...bankingKeys.all, 'accounts', includeArchived] as const,
  imports: (accountId?: string) => [...bankingKeys.all, 'imports', accountId ?? 'all'] as const,
  transactions: (filters: TransactionFilters, limit: number) =>
    [...bankingKeys.all, 'transactions', filters, limit] as const,
  flow: (filters: TransactionFilters) => [...bankingKeys.all, 'flow', filters] as const,
  balance: (accountId: string, asOf?: string) =>
    [...bankingKeys.all, 'balance', accountId, asOf ?? 'now'] as const,
  allocations: (transactionId: string) =>
    [...bankingKeys.all, 'allocations', transactionId] as const,
  suggestions: (transactionId: string) =>
    [...bankingKeys.all, 'suggestions', transactionId] as const,
  anchor: (accountId: string) => [...bankingKeys.all, 'anchor', accountId] as const,
  coverage: (accountId: string) => [...bankingKeys.all, 'coverage', accountId] as const,
  balanceHistory: (accountId: string, params: BalanceHistoryParams) =>
    [...bankingKeys.all, 'balance-history', accountId, params] as const,
  householdBalanceHistory: (params: BalanceHistoryParams) =>
    [...bankingKeys.all, 'balance-history', 'household', params] as const,
};

export function useBankAccounts(includeArchived = false) {
  return useQuery({
    queryKey: bankingKeys.accounts(includeArchived),
    queryFn: () => fetchBankAccounts(includeArchived),
  });
}

export function useCreateBankAccount() {
  const invalidate = useInvalidateMoney();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: BankAccountPayload) => createBankAccount(payload),
    onSuccess: () => {
      invalidate();
      toast({ description: t('banking.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useUpdateBankAccount() {
  const invalidate = useInvalidateMoney();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<BankAccountPayload> }) =>
      updateBankAccount(id, payload),
    onSuccess: () => {
      invalidate();
      toast({ description: t('banking.updated'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

/** Bare archive mutation — la page l'enveloppe dans useDeleteWithUndo. */
export function useArchiveBankAccount() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: (id: string) => archiveBankAccount(id),
    onSuccess: invalidate,
  });
}

export function useRestoreBankAccount() {
  const invalidate = useInvalidateMoney();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (id: string) => restoreBankAccount(id),
    onSuccess: () => {
      invalidate();
      toast({ description: t('banking.reopened'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

/**
 * Sur quoi le contrôle porte pour ce compte — et sinon pourquoi il ne porte pas.
 *
 * Sous la racine `banking` du cache, donc invalidée par `useInvalidateMoney` :
 * la fenêtre bouge à chaque import et à chaque correction du solde d'ouverture,
 * sans que la ligne du compte soit jamais réécrite.
 */
export function useAccountCoverage(accountId: string | undefined) {
  return useQuery({
    queryKey: bankingKeys.coverage(accountId ?? ''),
    queryFn: () => fetchAccountCoverage(accountId as string),
    enabled: Boolean(accountId),
  });
}

/**
 * La courbe d'un compte. Même racine de cache que le solde, donc invalidée par
 * le même import : les deux chiffres doivent bouger ensemble ou pas du tout.
 */
export function useAccountBalanceHistory(
  accountId: string | undefined,
  params: BalanceHistoryParams = {},
) {
  return useQuery({
    queryKey: bankingKeys.balanceHistory(accountId ?? '', params),
    queryFn: () => fetchAccountBalanceHistory(accountId as string, params),
    enabled: Boolean(accountId),
  });
}

/** Tous les comptes vivants sur un axe commun, plus le total du foyer. */
export function useHouseholdBalanceHistory(params: BalanceHistoryParams = {}) {
  return useQuery({
    queryKey: bankingKeys.householdBalanceHistory(params),
    queryFn: () => fetchHouseholdBalanceHistory(params),
  });
}

/**
 * Ce que House sait avant de demander quoi que ce soit : relevé porteur d'un
 * solde ou non, dernière opération détenue, périodes manquantes (lot 8).
 */
export function useBalanceAnchor(accountId: string | undefined) {
  return useQuery({
    queryKey: bankingKeys.anchor(accountId ?? ''),
    queryFn: () => fetchBalanceAnchor(accountId as string),
    enabled: Boolean(accountId),
  });
}

export function useSetBalanceAnchor() {
  const invalidate = useInvalidateMoney();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({
      accountId,
      payload,
    }: {
      accountId: string;
      payload?: { balance?: string; as_of?: string; from_date?: string };
    }) => setBalanceAnchor(accountId, payload ?? {}),
    onSuccess: () => {
      invalidate();
      // Le solde d'ouverture ouvre la fenêtre de conformité : les compteurs de
      // contrôle changent dans la foulée, souvent de zéro à plusieurs centaines.
      toast({ description: t('banking.anchor.applied'), variant: 'success' });
    },
  });
}

// --- Import de relevés (lot 2) ----------------------------------------------

export function useStatementImports(accountId?: string) {
  return useQuery({
    queryKey: bankingKeys.imports(accountId),
    queryFn: () => fetchStatementImports(accountId),
  });
}

export function usePreviewStatementFile() {
  return useMutation({ mutationFn: (file: File) => previewStatementFile(file) });
}

/**
 * Dépose un relevé.
 *
 * Pas de toast ici : l'import réussi, l'import vide (tout en doublon) et l'échec
 * de lecture sont trois issues différentes que seul le dialog sait raconter —
 * il lit `status` et `created_count` sur la trace retournée.
 */
export function useImportStatementFile() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: (params: {
      accountId: string;
      file: File;
      provider: string;
      options: StatementMapping;
    }) => importStatementFile(params),
    onSuccess: invalidate,
  });
}

// --- Journal bancaire (lot 3) -----------------------------------------------

export function useTransactions(
  filters: TransactionFilters,
  limit = 50,
  options: { enabled?: boolean; offset?: number } = {},
) {
  const offset = options.offset ?? 0;
  return useQuery({
    // L'offset entre dans la clé : sans lui, la page 2 servirait le cache de la
    // page 1 et le journal paraîtrait bloqué sur ses cinquante premières lignes.
    queryKey: [...bankingKeys.transactions(filters, limit), offset],
    queryFn: () => fetchTransactions(filters, limit, offset),
    enabled: options.enabled ?? true,
  });
}

export function useAccountFlow(filters: TransactionFilters) {
  return useQuery({
    queryKey: bankingKeys.flow(filters),
    queryFn: () => fetchAccountFlow(filters),
  });
}

export function useQualifyTransaction() {
  const invalidate = useInvalidateMoney();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        is_internal?: boolean;
        notes?: string;
        inflow_nature?: InflowNature;
        refund_budget_id?: string | null;
      };
    }) => qualifyTransaction(id, payload),
    onSuccess: () => {
      invalidate();
      toast({ description: t('banking.journal.qualified'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

// --- Soldes & espèces (lot 4) -----------------------------------------------

export function useAccountBalance(accountId: string | undefined, asOf?: string) {
  return useQuery({
    queryKey: bankingKeys.balance(accountId ?? '', asOf),
    queryFn: () => fetchAccountBalance(accountId as string, asOf),
    enabled: Boolean(accountId),
  });
}

export function useWithdrawToCash() {
  const invalidate = useInvalidateMoney();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({
      transactionId,
      payload,
    }: {
      transactionId: string;
      payload: { cash_account: string; amount?: string };
    }) => withdrawToCash(transactionId, payload),
    onSuccess: () => {
      invalidate();
      toast({ description: t('banking.withdraw.linked'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useUnlinkCashCounterpart() {
  const invalidate = useInvalidateMoney();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (transactionId: string) => unlinkCashCounterpart(transactionId),
    onSuccess: () => {
      invalidate();
      toast({ description: t('banking.withdraw.unlinked'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

// --- Ventilation (lot 5) ----------------------------------------------------

export function useAllocations(transactionId: string | undefined) {
  return useQuery({
    queryKey: bankingKeys.allocations(transactionId ?? ''),
    queryFn: () => fetchAllocations(transactionId as string),
    enabled: Boolean(transactionId),
  });
}

export function useSetAllocations() {
  const invalidate = useInvalidateMoney();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ transactionId, lines }: { transactionId: string; lines: AllocationLine[] }) =>
      setAllocations(transactionId, lines),
    onSuccess: () => {
      invalidate();
      // La ventilation crée/supprime des Interaction : les listes de dépenses et
      // les compteurs de budget doivent se rafraîchir aussi.
      // Ventiler résout (ou déplace) un écart : sans cette invalidation, le badge
      // « Contrôle » et la file « À ranger » afficheraient encore la ligne qu'on
      // vient de ranger — un compteur qui contredit l'écran est pire que pas de
      // compteur.
      toast({ description: t('banking.allocation.saved'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

/**
 * Détacher une dépense de sa ligne bancaire — sans la supprimer.
 *
 * Le geste manquait, et son absence n'était pas neutre : enregistrer une
 * ventilation détachait *en silence* tout ce que l'éditeur ne possède pas (un
 * achat de projet rapproché à la main). Le service ne le fait plus, donc il faut
 * un endroit pour le vouloir explicitement — ici.
 */
export function useSetRefundAllocations() {
  const invalidate = useInvalidateMoney();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({
      transactionId,
      lines,
    }: {
      transactionId: string;
      lines: RefundAllocationLine[];
    }) => setRefundAllocations(transactionId, lines),
    onSuccess: () => {
      // Toute écriture sur l'argent invalide tout l'argent : un remboursement
      // réparti change des plafonds, le Contrôle et la file en même temps.
      invalidate();
      toast({ description: t('banking.inflow.refundSaved'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useUnlinkAllocation() {
  const invalidate = useInvalidateMoney();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({
      transactionId,
      interactionId,
    }: {
      transactionId: string;
      interactionId: string;
    }) => unlinkAllocation(transactionId, interactionId),
    onSuccess: () => {
      invalidate();
      toast({ description: t('banking.allocation.linked.detached'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

// --- Rapprochement automatique (lot 6) --------------------------------------

export function useReconcile() {
  const invalidate = useInvalidateMoney();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (params: { date_from?: string; date_to?: string } = {}) =>
      reconcileTransactions(params),
    onSuccess: (outcome) => {
      invalidate();

      // Deux compteurs, un seul toast : la passe rapproche des dépenses **et**
      // confirme des échéances. Les annoncer séparément ferait deux toasts pour
      // une seule action de l'utilisateur.
      const total = outcome.auto_matched + outcome.recurring_confirmed;
      const parts: string[] = [];
      if (outcome.auto_matched > 0) {
        parts.push(t('banking.reconcile.matched', { count: outcome.auto_matched }));
      }
      if (outcome.recurring_confirmed > 0) {
        parts.push(
          t('banking.reconcile.recurringConfirmed', { count: outcome.recurring_confirmed }),
        );
      }
      toast({
        description: total > 0 ? parts.join(' · ') : t('banking.reconcile.nothingMatched'),
        variant: total > 0 ? 'success' : undefined,
      });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useSuggestions(transactionId: string | undefined) {
  return useQuery({
    queryKey: bankingKeys.suggestions(transactionId ?? ''),
    queryFn: () => fetchSuggestions(transactionId as string),
    enabled: Boolean(transactionId),
  });
}

export function useLinkInteraction() {
  const invalidate = useInvalidateMoney();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ transactionId, interactionId }: { transactionId: string; interactionId: string }) =>
      linkInteraction(transactionId, interactionId),
    onSuccess: () => {
      invalidate();
      toast({ description: t('banking.reconcile.linked'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useRecordCashExpense() {
  const invalidate = useInvalidateMoney();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: CashExpensePayload) => recordCashExpense(payload),
    onSuccess: () => {
      invalidate();
      // L'opération crée aussi une Interaction : dépenses, budgets et conformité
      // doivent se rafraîchir, sinon la dépense qu'on vient de saisir n'apparaît
      // nulle part avant un reload.
      toast({ description: t('banking.cash.recorded'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useRecordCashDeposit() {
  const invalidate = useInvalidateMoney();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: CashDepositPayload) => recordCashDeposit(payload),
    onSuccess: () => {
      invalidate();
      toast({ description: t('banking.cash.deposited'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

/** Corriger la part d'un retrait versée en caisse — résout `cash_mirror_partial`. */
export function useAdjustCashMirror() {
  const invalidate = useInvalidateMoney();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ transactionId, amount }: { transactionId: string; amount: string }) =>
      adjustCashMirror(transactionId, { amount }),
    onSuccess: () => {
      invalidate();
      toast({ description: t('banking.withdraw.adjusted'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}
