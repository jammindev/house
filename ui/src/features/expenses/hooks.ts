import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  createManualExpense,
  fetchExpenseSummary,
  type ExpenseSummaryFilters,
  type ManualExpensePayload,
} from '@/lib/api/expenses';
import { toast } from '@/lib/toast';
import { EXPENSES_ROOT } from '@/features/money/keys';
import { useInvalidateMoney } from '@/features/money/invalidate';

export const expenseKeys = {
  all: EXPENSES_ROOT,
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
  const invalidate = useInvalidateMoney();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: (payload: ManualExpensePayload) => createManualExpense(payload),
    onSuccess: () => {
      invalidate();
      toast({ description: t('expenses.adhoc.created'), variant: 'success' });
    },
    onError: () => toast({ description: t('common.saveFailed'), variant: 'destructive' }),
  });
}
