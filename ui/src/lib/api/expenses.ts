import { api } from '@/lib/axios';

export interface ExpenseSummaryRow {
  kind: string;
  total: string;
  count: number;
}

export interface ExpenseSupplierRow {
  supplier: string;
  total: string;
  count: number;
}

export interface ExpenseMonthRow {
  month: string;
  total: string;
  count: number;
}

export interface ExpenseSummary {
  period: { from: string | null; to: string | null };
  total: string;
  count: number;
  by_kind: ExpenseSummaryRow[];
  by_supplier: ExpenseSupplierRow[];
  by_month: ExpenseMonthRow[];
}

export interface ExpenseSummaryFilters {
  from?: string;
  to?: string;
  supplier?: string;
  kind?: string;
}

export async function fetchExpenseSummary(filters: ExpenseSummaryFilters = {}): Promise<ExpenseSummary> {
  const params: Record<string, string> = {};
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.supplier) params.supplier = filters.supplier;
  if (filters.kind) params.kind = filters.kind;
  const { data } = await api.get<ExpenseSummary>('/interactions/expenses/summary/', { params });
  return data;
}
