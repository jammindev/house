import { useQuery } from '@tanstack/react-query';
import { fetchExpenseSummary, type ExpenseSummaryFilters } from '@/lib/api/expenses';

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
