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
  ratio: number;
  state: BudgetState;
}

export interface BudgetOverview {
  month: string | null;
  global: BudgetOverviewRow | null;
  budgets: BudgetOverviewRow[];
  unbudgeted: string;
  total_spent: string;
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
