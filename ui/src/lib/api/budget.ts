import { api } from '@/lib/axios';

export interface Budget {
  id: string;
  name: string;
  /** Plafond mensuel. `null` = catégorie suivie, non plafonnée. */
  monthly_amount: string | null;
  is_global: boolean;
  /** La catégorie sous laquelle ce budget est rangé, s'il y en a une. */
  category: { id: string; name: string } | null;
  created_at: string;
  updated_at: string;
}

/**
 * Une **catégorie** de budgets — « Maison » au-dessus de « Bricolage ».
 *
 * C'est un type à part, jamais un budget : aucune dépense ne peut s'y ranger,
 * donc elle n'apparaît dans aucun sélecteur de dépense et il n'y a rien à en
 * filtrer nulle part.
 */
export interface BudgetCategory {
  id: string;
  name: string;
  /** Plafond mensuel optionnel. `null` = simple sous-total. */
  monthly_amount: string | null;
  budget_count: number;
  created_at: string;
  updated_at: string;
}

export interface BudgetCategoryPayload {
  name: string;
  monthly_amount?: number | null;
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
  /**
   * La part de `spent` qu'une ligne de relevé justifie, et le reste.
   * `spent_attested + spent_pending === spent`, toujours : le second est calculé
   * par différence côté serveur.
   */
  spent_attested: string;
  spent_pending: string;
  /**
   * Ce que le mois a **rendu** à l'enveloppe : articles retournés, cotisations
   * remboursées. `net_spent === spent - refunded`, et c'est le **net** que le
   * plafond mesure — de l'argent rendu n'a pas été dépensé. `spent` garde sa
   * définition brute, que sept agrégations lisent.
   */
  refunded: string;
  net_spent: string;
  committed: string;
  ratio: number;
  state: BudgetState;
  /** Catégorie sous laquelle ranger cette ligne à l'affichage. */
  category_id: string | null;
}

/**
 * Le sous-total d'une catégorie, **calculé par le serveur**.
 *
 * Ne jamais le recalculer côté client à partir de `budgets` : le total et le
 * panneau se mettraient à répondre chacun le sien à « combien a-t-on dépensé ? »,
 * et c'est exactement la règle « un compteur ne peut pas avoir deux définitions ».
 */
export interface BudgetCategoryRow {
  id: string;
  name: string;
  /**
   * Plafond de la catégorie : le sien s'il existe, sinon la somme de ceux des
   * budgets qu'elle range. `null` quand aucun n'en a — jamais "0.00".
   */
  amount: string | null;
  /** Vrai quand `amount` est le plafond propre de la catégorie, pas une somme. */
  has_own_amount: boolean;
  spent: string;
  spent_attested: string;
  spent_pending: string;
  refunded: string;
  net_spent: string;
  committed: string;
  ratio: number;
  state: BudgetState;
  budget_count: number;
}

export interface BudgetOverview {
  month: string | null;
  global: BudgetOverviewRow | null;
  budgets: BudgetOverviewRow[];
  categories: BudgetCategoryRow[];
  unbudgeted: string;
  total_spent: string;
  total_attested: string;
  total_pending: string;
  total_refunded: string;
  total_net_spent: string;
  total_committed: string;
  named_total_amount: string;
  named_exceeds_global: boolean;
}

export interface BudgetPayload {
  name: string;
  /** Omis ou `null` = catégorie sans plafond. Requis sur le budget global. */
  monthly_amount?: number | null;
  is_global?: boolean;
  /** Catégorie de rangement ; `null` explicite sort le budget de la sienne. */
  category_id?: string | null;
}

// --- Analyse fine des dépenses par budget -----------------------------------

/**
 * Une série mensuelle. `name: null` = « hors budget » — le libellé vit dans
 * l'i18n du front, pas dans la réponse, pour qu'ajouter une langue n'impose pas
 * un passage par les `.po` du backend.
 */
export interface AnalysisSeries {
  budget_id: string | null;
  name: string | null;
  /** Plafond du budget, `null` quand la catégorie n'en a pas. */
  monthly_amount: string | null;
  /** Un montant par mois de `months`, même index, zéros compris. */
  values: string[];
  total: string;
}

export interface AnalysisBreakdownRow {
  budget_id: string | null;
  name: string | null;
  total: string;
  /** Part du total de la fenêtre, entre 0 et 1. `0` quand rien n'a été dépensé. */
  share: number;
}

export interface AnalysisSupplier {
  supplier: string;
  total: string;
  count: number;
}

export interface AnalysisBiggest {
  id: string;
  subject: string;
  amount: string;
  occurred_at: string | null;
  budget_id: string | null;
  budget_name: string | null;
}

export interface BudgetAnalysis {
  /** `YYYY-MM`, du plus ancien au plus récent. */
  months: string[];
  series: AnalysisSeries[];
  breakdown: AnalysisBreakdownRow[];
  suppliers: AnalysisSupplier[];
  biggest: AnalysisBiggest[];
  total: string;
  monthly_average: string;
}

export async function fetchBudgetAnalysis(params: {
  months: number;
  budget?: string | null;
}): Promise<BudgetAnalysis> {
  const { data } = await api.get<BudgetAnalysis>('/budget/budgets/analysis/', {
    params: { months: params.months, ...(params.budget ? { budget: params.budget } : {}) },
  });
  return data;
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

// --- Catégories de budget ---------------------------------------------------

export async function fetchBudgetCategories(): Promise<BudgetCategory[]> {
  const { data } = await api.get<BudgetCategory[] | { results: BudgetCategory[] }>(
    '/budget/categories/',
  );
  return Array.isArray(data) ? data : data.results;
}

export async function createBudgetCategory(
  payload: BudgetCategoryPayload,
): Promise<BudgetCategory> {
  const { data } = await api.post<BudgetCategory>('/budget/categories/', payload);
  return data;
}

export async function updateBudgetCategory(
  id: string,
  payload: Partial<BudgetCategoryPayload>,
): Promise<BudgetCategory> {
  const { data } = await api.patch<BudgetCategory>(`/budget/categories/${id}/`, payload);
  return data;
}

export async function deleteBudgetCategory(id: string): Promise<void> {
  await api.delete(`/budget/categories/${id}/`);
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
