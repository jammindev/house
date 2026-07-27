import { api } from '@/lib/axios';

export interface Budget {
  id: string;
  name: string;
  /** Plafond mensuel. `null` = catégorie suivie, non plafonnée. */
  monthly_amount: string | null;
  is_global: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * `uncapped` n'est pas `ok` : une catégorie sans plafond ne peut être ni
 * respectée ni dépassée. La rendre « ok » afficherait une barre verte à 0 %
 * sur quelque chose qui n'a pas d'échelle.
 */
export type BudgetState = 'uncapped' | 'ok' | 'warning' | 'over';

export interface BudgetOverviewRow {
  id: string;
  name: string;
  /** `null` quand la catégorie n'a pas de plafond — jamais "0.00". */
  amount: string | null;
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
  /** Omis ou `null` = catégorie sans plafond. Requis sur le budget global. */
  monthly_amount?: number | null;
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

// --- Monthly reports (parcours 21 lot 3) ------------------------------------

export interface BudgetReport {
  id: string;
  month: string; // 'YYYY-MM'
  text: string; // rendered in the user's language (AI-polished on latest/detail)
  stats: Record<string, unknown>;
  created_at: string;
}

export async function fetchBudgetReports(): Promise<BudgetReport[]> {
  const { data } = await api.get<BudgetReport[] | { results: BudgetReport[] }>('/budget/reports/');
  return unwrapList(data);
}

export async function fetchLatestBudgetReport(): Promise<BudgetReport | null> {
  const { data } = await api.get<BudgetReport | null>('/budget/reports/latest/');
  return data;
}
