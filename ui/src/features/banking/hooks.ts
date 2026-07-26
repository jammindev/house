import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  archiveBankAccount,
  createBankAccount,
  fetchAccountBalance,
  fetchAccountFlow,
  fetchBankAccounts,
  fetchStatementImports,
  fetchTransactions,
  importStatementFile,
  previewStatementFile,
  qualifyTransaction,
  restoreBankAccount,
  unlinkCashCounterpart,
  updateBankAccount,
  withdrawToCash,
  type BankAccountPayload,
  type StatementMapping,
  type TransactionFilters,
} from '@/lib/api/banking';
import { toast } from '@/lib/toast';

export const bankingKeys = {
  all: ['banking'] as const,
  accounts: (includeArchived: boolean) =>
    [...bankingKeys.all, 'accounts', includeArchived] as const,
  imports: (accountId?: string) => [...bankingKeys.all, 'imports', accountId ?? 'all'] as const,
  transactions: (filters: TransactionFilters, limit: number) =>
    [...bankingKeys.all, 'transactions', filters, limit] as const,
  flow: (filters: TransactionFilters) => [...bankingKeys.all, 'flow', filters] as const,
  balance: (accountId: string, asOf?: string) =>
    [...bankingKeys.all, 'balance', accountId, asOf ?? 'now'] as const,
};

export function useBankAccounts(includeArchived = false) {
  return useQuery({
    queryKey: bankingKeys.accounts(includeArchived),
    queryFn: () => fetchBankAccounts(includeArchived),
  });
}

function useInvalidateBanking() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: bankingKeys.all });
  };
}

export function useCreateBankAccount() {
  const invalidate = useInvalidateBanking();
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
  const invalidate = useInvalidateBanking();
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
  const invalidate = useInvalidateBanking();
  return useMutation({
    mutationFn: (id: string) => archiveBankAccount(id),
    onSuccess: invalidate,
  });
}

export function useRestoreBankAccount() {
  const invalidate = useInvalidateBanking();
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
  const invalidate = useInvalidateBanking();
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

export function useTransactions(filters: TransactionFilters, limit = 50) {
  return useQuery({
    queryKey: bankingKeys.transactions(filters, limit),
    queryFn: () => fetchTransactions(filters, limit),
  });
}

export function useAccountFlow(filters: TransactionFilters) {
  return useQuery({
    queryKey: bankingKeys.flow(filters),
    queryFn: () => fetchAccountFlow(filters),
  });
}

export function useQualifyTransaction() {
  const invalidate = useInvalidateBanking();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { is_internal?: boolean; notes?: string } }) =>
      qualifyTransaction(id, payload),
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
  const invalidate = useInvalidateBanking();
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
      toast({ description: t('banking.cash.linked'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useUnlinkCashCounterpart() {
  const invalidate = useInvalidateBanking();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (transactionId: string) => unlinkCashCounterpart(transactionId),
    onSuccess: () => {
      invalidate();
      toast({ description: t('banking.cash.unlinked'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}
