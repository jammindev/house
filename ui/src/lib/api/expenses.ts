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
  /**
   * Ce que la période a **rendu**, et le net. `total` reste le brut — c'est lui
   * que décomposent `by_kind` / `by_supplier` / `by_month`.
   */
  refunded: string;
  net_total: string;
  by_kind: ExpenseSummaryRow[];
  by_supplier: ExpenseSupplierRow[];
  by_month: ExpenseMonthRow[];
}

export interface ExpenseSummaryFilters {
  from?: string;
  to?: string;
  supplier?: string;
  kind?: string;
  /** Id d'un budget, ou `'none'` pour le seau « hors budget ». */
  budget?: string;
  /**
   * ⚠️ « Celles auxquelles il manque un fournisseur » — et il **doit** partir au
   * serveur, qui le lit (`interactions.views::summary`).
   *
   * Il manquait ici : l'onglet Dépenses le composait bien dans ses filtres et
   * documentait que « le résumé porte le même filtre que la liste », mais cette
   * fonction ne transmettait pas la clé. Les cartes de total comptaient donc
   * toute la période au-dessus d'une liste réduite aux dépenses sans
   * fournisseur — exactement le « compteur qui compte des lignes que la liste ne
   * montre pas » contre lequel le commentaire du serveur met en garde. Un filtre
   * qui n'est pas transmis ne se voit pas : l'écran reste plausible, seulement
   * faux.
   */
  without_supplier?: string;
}

export async function fetchExpenseSummary(filters: ExpenseSummaryFilters = {}): Promise<ExpenseSummary> {
  const params: Record<string, string> = {};
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.supplier) params.supplier = filters.supplier;
  if (filters.kind) params.kind = filters.kind;
  if (filters.budget) params.budget = filters.budget;
  if (filters.without_supplier) params.without_supplier = filters.without_supplier;
  const { data } = await api.get<ExpenseSummary>('/interactions/interactions/expenses/summary/', { params });
  return data;
}

export interface ManualExpensePayload {
  subject: string;
  amount: number | null;
  supplier?: string;
  occurred_at?: string | null;
  notes?: string;
  zone_ids?: string[];
  /** Optional monthly budget to attach this expense to (parcours 21). */
  budget_id?: string | null;
}

export async function createManualExpense(payload: ManualExpensePayload): Promise<{ id: string }> {
  const body: Record<string, unknown> = { subject: payload.subject };
  if (payload.amount !== null && payload.amount !== undefined) body.amount = payload.amount;
  if (payload.supplier) body.supplier = payload.supplier;
  if (payload.occurred_at) body.occurred_at = payload.occurred_at;
  if (payload.notes) body.notes = payload.notes;
  if (payload.zone_ids && payload.zone_ids.length > 0) body.zone_ids = payload.zone_ids;
  if (payload.budget_id) body.budget_id = payload.budget_id;
  const { data } = await api.post('/interactions/interactions/expenses/manual/', body);
  return data as { id: string };
}
