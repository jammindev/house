import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  createManualExpense,
  fetchExpenseSummary,
  type ExpenseSummaryFilters,
  type ManualExpensePayload,
} from '@/lib/api/expenses';
import { toast } from '@/lib/toast';

export const expenseKeys = {
  all: ['expenses'] as const,
  summary: (filters?: ExpenseSummaryFilters) =>
    [...expenseKeys.all, 'summary', filters] as const,
};

export function useExpenseSummary(filters: ExpenseSummaryFilters = {}) {
  return useQuery({
    queryKey: expenseKeys.summary(filters),
    queryFn: () => fetchExpenseSummary(filters),
  });
}

export function useCreateManualExpense() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: ManualExpensePayload) => createManualExpense(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: expenseKeys.all });
      qc.invalidateQueries({ queryKey: ['interactions'] });
      toast({ description: t('expenses.adhoc.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}
