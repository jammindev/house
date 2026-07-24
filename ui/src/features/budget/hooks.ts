import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  confirmRecurringOccurrence,
  createBudget,
  createRecurringExpense,
  deleteBudget,
  deleteRecurringExpense,
  fetchBudgetOverview,
  fetchBudgetReports,
  fetchBudgets,
  fetchCashflowProjection,
  fetchLatestBudgetReport,
  fetchRecurringDue,
  fetchRecurringExpenses,
  updateBudget,
  updateRecurringExpense,
  type BudgetPayload,
  type RecurringExpensePayload,
} from '@/lib/api/budget';
import { toast } from '@/lib/toast';

export const budgetKeys = {
  all: ['budget'] as const,
  list: () => [...budgetKeys.all, 'list'] as const,
  overview: () => [...budgetKeys.all, 'overview'] as const,
  recurring: () => [...budgetKeys.all, 'recurring'] as const,
  recurringDue: () => [...budgetKeys.all, 'recurring', 'due'] as const,
  projection: () => [...budgetKeys.all, 'projection'] as const,
  reports: () => [...budgetKeys.all, 'reports'] as const,
  latestReport: () => [...budgetKeys.all, 'reports', 'latest'] as const,
};

export function useBudgets() {
  return useQuery({ queryKey: budgetKeys.list(), queryFn: fetchBudgets });
}

export function useBudgetOverview() {
  return useQuery({ queryKey: budgetKeys.overview(), queryFn: fetchBudgetOverview });
}

function useInvalidateBudget() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: budgetKeys.all });
  };
}

export function useCreateBudget() {
  const invalidate = useInvalidateBudget();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: BudgetPayload) => createBudget(payload),
    onSuccess: () => {
      invalidate();
      toast({ description: t('budget.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useUpdateBudget() {
  const invalidate = useInvalidateBudget();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<BudgetPayload> }) =>
      updateBudget(id, payload),
    onSuccess: () => {
      invalidate();
      toast({ description: t('budget.updated'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

/** Bare delete mutation — the page wraps it in useDeleteWithUndo for the toast. */
export function useDeleteBudget() {
  const invalidate = useInvalidateBudget();
  return useMutation({
    mutationFn: (id: string) => deleteBudget(id),
    onSuccess: invalidate,
  });
}

// --- Recurring expenses -----------------------------------------------------

export function useRecurringExpenses() {
  return useQuery({ queryKey: budgetKeys.recurring(), queryFn: fetchRecurringExpenses });
}

export function useRecurringDue() {
  return useQuery({ queryKey: budgetKeys.recurringDue(), queryFn: fetchRecurringDue });
}

export function useCashflowProjection() {
  return useQuery({ queryKey: budgetKeys.projection(), queryFn: fetchCashflowProjection });
}

export function useCreateRecurringExpense() {
  const invalidate = useInvalidateBudget();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: RecurringExpensePayload) => createRecurringExpense(payload),
    onSuccess: () => {
      invalidate();
      toast({ description: t('recurring.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useUpdateRecurringExpense() {
  const invalidate = useInvalidateBudget();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<RecurringExpensePayload> }) =>
      updateRecurringExpense(id, payload),
    onSuccess: () => {
      invalidate();
      toast({ description: t('recurring.updated'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

/** Bare delete mutation — the page wraps it in useDeleteWithUndo. */
export function useDeleteRecurringExpense() {
  const invalidate = useInvalidateBudget();
  return useMutation({
    mutationFn: (id: string) => deleteRecurringExpense(id),
    onSuccess: invalidate,
  });
}

export function useConfirmRecurringOccurrence() {
  const invalidate = useInvalidateBudget();
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount?: number | null }) =>
      confirmRecurringOccurrence(id, amount),
    onSuccess: () => {
      invalidate();
      // the confirmation created an expense — refresh expense/interaction views too
    },
  });
}

// --- Monthly reports --------------------------------------------------------

export function useBudgetReports() {
  return useQuery({ queryKey: budgetKeys.reports(), queryFn: fetchBudgetReports });
}

export function useLatestBudgetReport() {
  return useQuery({ queryKey: budgetKeys.latestReport(), queryFn: fetchLatestBudgetReport });
}
