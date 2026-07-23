import { api } from '@/lib/axios';

export interface Budget {
  id: string;
  name: string;
  monthly_amount: string;
  is_global: boolean;
  created_at: string;
  updated_at: string;
}

export type BudgetState = 'ok' | 'warning' | 'over';

export interface BudgetOverviewRow {
  id: string;
  name: string;
  amount: string;
  spent: string;
  committed: string;
  ratio: number;
  state: BudgetState;
}

export interface BudgetOverview {
  month: string | null;
  global: BudgetOverviewRow | null;
  budgets: BudgetOverviewRow[];
  unbudgeted: string;
  total_spent: string;
  total_committed: string;
  named_total_amount: string;
  named_exceeds_global: boolean;
}

export interface BudgetPayload {
  name: string;
  monthly_amount: number;
  is_global?: boolean;
}

export async function fetchBudgets(): Promise<Budget[]> {
  const { data } = await api.get<Budget[] | { results: Budget[] }>('/budget/budgets/');
  return Array.isArray(data) ? data : data.results;
}

export async function fetchBudgetOverview(): Promise<BudgetOverview> {
  const { data } = await api.get<BudgetOverview>('/budget/budgets/overview/');
  return data;
}

export async function createBudget(payload: BudgetPayload): Promise<Budget> {
  const { data } = await api.post<Budget>('/budget/budgets/', payload);
  return data;
}

export async function updateBudget(id: string, payload: Partial<BudgetPayload>): Promise<Budget> {
  const { data } = await api.patch<Budget>(`/budget/budgets/${id}/`, payload);
  return data;
}

export async function deleteBudget(id: string): Promise<void> {
  await api.delete(`/budget/budgets/${id}/`);
}

// --- Recurring expenses (parcours 21 lot 2) ---------------------------------

export type Cadence = 'monthly' | 'quarterly' | 'yearly';

export interface RecurringExpense {
  id: string;
  label: string;
  amount: string;
  cadence: Cadence;
  next_due_date: string;
  supplier: string;
  notes: string;
  budget: { id: string; name: string } | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringExpensePayload {
  label: string;
  amount: number;
  cadence: Cadence;
  next_due_date: string;
  supplier?: string;
  notes?: string;
  budget_id?: string | null;
}

export interface CashflowHorizon {
  days: number;
  total: string;
  count: number;
}

export interface CashflowProjection {
  today: string | null;
  horizons: CashflowHorizon[];
}

export interface ConfirmResult {
  recurring: RecurringExpense;
  interaction_id: string;
}

function unwrapList<T>(data: T[] | { results: T[] }): T[] {
  return Array.isArray(data) ? data : data.results;
}

export async function fetchRecurringExpenses(): Promise<RecurringExpense[]> {
  const { data } = await api.get<RecurringExpense[] | { results: RecurringExpense[] }>(
    '/budget/recurring/',
  );
  return unwrapList(data);
}

export async function fetchRecurringDue(): Promise<RecurringExpense[]> {
  const { data } = await api.get<RecurringExpense[]>('/budget/recurring/due/');
  return data;
}

export async function fetchCashflowProjection(): Promise<CashflowProjection> {
  const { data } = await api.get<CashflowProjection>('/budget/recurring/projection/');
  return data;
}

export async function createRecurringExpense(
  payload: RecurringExpensePayload,
): Promise<RecurringExpense> {
  const { data } = await api.post<RecurringExpense>('/budget/recurring/', payload);
  return data;
}

export async function updateRecurringExpense(
  id: string,
  payload: Partial<RecurringExpensePayload>,
): Promise<RecurringExpense> {
  const { data } = await api.patch<RecurringExpense>(`/budget/recurring/${id}/`, payload);
  return data;
}

export async function deleteRecurringExpense(id: string): Promise<void> {
  await api.delete(`/budget/recurring/${id}/`);
}

export async function confirmRecurringOccurrence(
  id: string,
  amount?: number | null,
): Promise<ConfirmResult> {
  const body = amount != null ? { amount } : {};
  const { data } = await api.post<ConfirmResult>(`/budget/recurring/${id}/confirm/`, body);
  return data;
}
