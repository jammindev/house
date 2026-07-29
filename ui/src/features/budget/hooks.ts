import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  confirmRecurringOccurrence,
  createBudget,
  createBudgetCategory,
  createRecurringExpense,
  deleteBudget,
  deleteBudgetCategory,
  deleteRecurringExpense,
  fetchBudgetAnalysis,
  fetchBudgetCategories,
  fetchBudgetInsights,
  fetchBudgetOverview,
  fetchBudgetReports,
  fetchBudgets,
  fetchCashflowProjection,
  fetchLatestBudgetReport,
  fetchRecurringDue,
  fetchRecurringExpenses,
  updateBudget,
  updateBudgetCategory,
  updateRecurringExpense,
  type BudgetCategoryPayload,
  type BudgetPayload,
  type RecurringExpensePayload,
} from '@/lib/api/budget';
import { toast } from '@/lib/toast';
import { BUDGET_ROOT } from '@/features/money/keys';
import { useInvalidateMoney } from '@/features/money/invalidate';

export const budgetKeys = {
  all: BUDGET_ROOT,
  list: () => [...budgetKeys.all, 'list'] as const,
  categories: () => [...budgetKeys.all, 'categories'] as const,
  overview: () => [...budgetKeys.all, 'overview'] as const,
  recurring: () => [...budgetKeys.all, 'recurring'] as const,
  recurringDue: () => [...budgetKeys.all, 'recurring', 'due'] as const,
  projection: () => [...budgetKeys.all, 'projection'] as const,
  reports: () => [...budgetKeys.all, 'reports'] as const,
  latestReport: () => [...budgetKeys.all, 'reports', 'latest'] as const,
  analysis: (months: number, budget: string | null) =>
    [...budgetKeys.all, 'analysis', months, budget] as const,
  insights: (budget: string, from?: string, to?: string) =>
    [...budgetKeys.all, 'insights', budget, from ?? '', to ?? ''] as const,
};

export function useBudgets() {
  return useQuery({ queryKey: budgetKeys.list(), queryFn: fetchBudgets });
}

export function useBudgetOverview() {
  return useQuery({ queryKey: budgetKeys.overview(), queryFn: fetchBudgetOverview });
}

export function useCreateBudget() {
  const invalidate = useInvalidateMoney();
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
  const invalidate = useInvalidateMoney();
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
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: (id: string) => deleteBudget(id),
    onSuccess: invalidate,
  });
}

// --- Catégories de budget ---------------------------------------------------

export function useBudgetCategories() {
  return useQuery({ queryKey: budgetKeys.categories(), queryFn: fetchBudgetCategories });
}

export function useCreateBudgetCategory() {
  const invalidate = useInvalidateMoney();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: BudgetCategoryPayload) => createBudgetCategory(payload),
    onSuccess: () => {
      invalidate();
      toast({ description: t('budget.category.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

export function useUpdateBudgetCategory() {
  const invalidate = useInvalidateMoney();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<BudgetCategoryPayload> }) =>
      updateBudgetCategory(id, payload),
    onSuccess: () => {
      invalidate();
      toast({ description: t('budget.category.updated'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}

/** Bare delete mutation — the panel wraps it in useDeleteWithUndo for the toast. */
export function useDeleteBudgetCategory() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: (id: string) => deleteBudgetCategory(id),
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
  const invalidate = useInvalidateMoney();
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
  const invalidate = useInvalidateMoney();
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
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: (id: string) => deleteRecurringExpense(id),
    onSuccess: invalidate,
  });
}

export function useConfirmRecurringOccurrence() {
  const invalidate = useInvalidateMoney();
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

// --- Analyse fine -----------------------------------------------------------

/**
 * La lecture longue des dépenses par budget.
 *
 * `staleTime` d'une minute : l'analyse porte sur des mois, elle ne bouge pas
 * pendant qu'on change de filtre — et refaire quatre agrégats à chaque aller-
 * retour entre deux budgets serait payé pour rien.
 */
export function useBudgetAnalysis(months: number, budget: string | null) {
  return useQuery({
    queryKey: budgetKeys.analysis(months, budget),
    queryFn: () => fetchBudgetAnalysis({ months, budget }),
    staleTime: 60_000,
  });
}

/**
 * La fiche d'une enveloppe : son total, sa période précédente, sa forme, ses
 * fournisseurs. Un seul appel, `budget` valant un id ou `none`.
 *
 * Tout arrive du serveur pour une raison de fond : le total affiché ici est
 * celui du panneau Budgets, et le graphique juste en dessous doit le recomposer.
 * Recalculer l'un des deux dans le navigateur donnerait au même compteur une
 * seconde définition — la faute que ce module passe son temps à réparer.
 */
export function useBudgetInsights(budget: string, from?: string, to?: string) {
  return useQuery({
    queryKey: budgetKeys.insights(budget, from, to),
    queryFn: () => fetchBudgetInsights({ budget, from, to }),
    staleTime: 60_000,
  });
}
