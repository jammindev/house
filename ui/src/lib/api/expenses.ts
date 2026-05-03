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

export interface ManualExpensePayload {
  subject: string;
  amount: number | null;
  supplier?: string;
  occurred_at?: string | null;
  notes?: string;
  zone_ids?: string[];
}

export async function createManualExpense(payload: ManualExpensePayload): Promise<{ id: string }> {
  const body: Record<string, unknown> = { subject: payload.subject };
  if (payload.amount !== null && payload.amount !== undefined) body.amount = payload.amount;
  if (payload.supplier) body.supplier = payload.supplier;
  if (payload.occurred_at) body.occurred_at = payload.occurred_at;
  if (payload.notes) body.notes = payload.notes;
  if (payload.zone_ids && payload.zone_ids.length > 0) body.zone_ids = payload.zone_ids;
  const { data } = await api.post('/interactions/expenses/manual/', body);
  return data as { id: string };
}
