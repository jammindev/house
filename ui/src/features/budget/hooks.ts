import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  createBudget,
  deleteBudget,
  fetchBudgetOverview,
  fetchBudgets,
  updateBudget,
  type BudgetPayload,
} from '@/lib/api/budget';
import { toast } from '@/lib/toast';

export const budgetKeys = {
  all: ['budget'] as const,
  list: () => [...budgetKeys.all, 'list'] as const,
  overview: () => [...budgetKeys.all, 'overview'] as const,
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
