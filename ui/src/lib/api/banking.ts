import { api, postMultipart } from '@/lib/axios';

/** Un compte du foyer — compte bancaire ou espèces (parcours 25, lot 1). */
export interface BankAccount {
  id: string;
  name: string;
  bank_label: string;
  kind: BankAccountKind;
  currency: string;
  iban_last4: string;
  /** Decimal sérialisé en string par DRF ; peut être négatif (découvert). */
  opening_balance: string;
  opening_balance_date: string | null;
  /**
   * Solde relevé par l'utilisateur sur sa banque, dont `opening_balance` a été
   * reconstruit (lot 8). Conservé pour que la soustraction reste vérifiable :
   * le détecteur `account_anchor_stale` la refait à chaque recalcul.
   */
  attested_balance: string | null;
  attested_on: string | null;
  /** Écrits par le service d'import (lot 2), jamais par le client. */
  default_provider: string;
  import_options: Record<string, unknown>;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export type BankAccountKind = 'bank' | 'cash';

export interface BankAccountPayload {
  name: string;
  bank_label?: string;
  kind?: BankAccountKind;
  currency?: string;
  iban_last4?: string;
  opening_balance?: string;
  opening_balance_date?: string | null;
  archived?: boolean;
}

export async function fetchBankAccounts(includeArchived = false): Promise<BankAccount[]> {
  const { data } = await api.get<BankAccount[] | { results: BankAccount[] }>('/banking/accounts/', {
    params: includeArchived ? { archived: 'true' } : undefined,
  });
  return Array.isArray(data) ? data : data.results;
}

export async function createBankAccount(payload: BankAccountPayload): Promise<BankAccount> {
  const { data } = await api.post<BankAccount>('/banking/accounts/', payload);
  return data;
}

export async function updateBankAccount(
  id: string,
  payload: Partial<BankAccountPayload>,
): Promise<BankAccount> {
  const { data } = await api.patch<BankAccount>(`/banking/accounts/${id}/`, payload);
  return data;
}

/**
 * DELETE archive le compte côté serveur — il n'est jamais détruit, parce qu'il
 * portera l'historique importé dès le lot 2.
 */
export async function archiveBankAccount(id: string): Promise<void> {
  await api.delete(`/banking/accounts/${id}/`);
}

/** Undo de l'archivage : le compte redevient actif. */
export async function restoreBankAccount(id: string): Promise<BankAccount> {
  return updateBankAccount(id, { archived: false });
}

// --- Retrouver le solde d'ouverture (parcours 26, lot 8) --------------------

/**
 * D'où le solde d'ouverture peut venir : `statement` = la banque l'a imprimé,
 * rien à demander ; `attestation` = seul l'utilisateur peut le fournir, en
 * lisant son solde du jour ; `none` = pas une ligne, rien à reconstruire.
 */
export type AnchorSource = 'statement' | 'attestation' | 'none';

export interface AnchorOperation {
  booked_on: string;
  label: string;
  amount: string;
}

export interface BalanceAnchorContext {
  source: AnchorSource;
  transaction_count: number;
  earliest_line: string | null;
  latest_line: string | null;
  /** La dernière opération détenue — ce que l'utilisateur compare à sa banque. */
  last_operation: AnchorOperation | null;
  /** Net de tout ce qui est détenu : ce que l'aperçu retranche du solde lu. */
  movements: string;
  proposed_opening_balance: string | null;
  proposed_opening_date: string | null;
  gaps: { gap_start: string; gap_end: string; days: number }[];
}

export interface BalanceAnchorResult {
  source: AnchorSource;
  opening_balance: string;
  opening_balance_date: string;
  /** Le total soustrait — affiché pour que le calcul soit refaisable à la main. */
  movements: string | null;
  account: BankAccount;
}

export async function fetchBalanceAnchor(accountId: string): Promise<BalanceAnchorContext> {
  const { data } = await api.get<BalanceAnchorContext>(
    `/banking/accounts/${accountId}/balance-anchor/`,
  );
  return data;
}

/**
 * Sans `balance`/`as_of`, le serveur applique le solde lu dans le relevé — la
 * voie sûre, quand elle existe.
 */
export async function setBalanceAnchor(
  accountId: string,
  payload: { balance?: string; as_of?: string; from_date?: string } = {},
): Promise<BalanceAnchorResult> {
  const { data } = await api.post<BalanceAnchorResult>(
    `/banking/accounts/${accountId}/balance-anchor/`,
    payload,
  );
  return data;
}

// --- Import de relevés (parcours 25, lot 2) ---------------------------------

export type ImportStatus = 'completed' | 'failed';

/** Trace d'un dépôt de fichier. Un échec métier est une ligne, pas une erreur HTTP. */
export interface StatementImport {
  id: string;
  account: string;
  account_name: string;
  provider: string;
  filename: string;
  status: ImportStatus;
  created_count: number;
  skipped_count: number;
  error: string;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
}

/** Aperçu du fichier déposé, pour construire le mapping de colonnes. */
export interface StatementPreview {
  detected_provider: string;
  columns: string[];
  sample_lines: string[];
}

/**
 * Mapping des colonnes de la banque. Décrit une fois, mémorisé sur le compte.
 * Soit `amount_column`, soit le couple `debit_column`/`credit_column`.
 */
export interface StatementMapping {
  date_column: string;
  label_column: string;
  amount_column?: string;
  debit_column?: string;
  credit_column?: string;
  balance_column?: string;
  reference_column?: string;
  value_date_column?: string;
  date_format?: string;
  decimal_separator?: string;
  currency?: string;
  invert_sign?: boolean;
  delimiter?: string;
  skip_rows?: number;
  sheet?: string;
}

export async function fetchStatementImports(accountId?: string): Promise<StatementImport[]> {
  const { data } = await api.get<StatementImport[] | { results: StatementImport[] }>(
    '/banking/imports/',
    { params: accountId ? { account: accountId } : undefined },
  );
  return Array.isArray(data) ? data : data.results;
}

export async function previewStatementFile(file: File): Promise<StatementPreview> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await postMultipart<StatementPreview>('/banking/imports/preview/', form);
  return data;
}

/**
 * Dépose un relevé. Renvoie **toujours** la trace : un fichier illisible produit
 * un 201 avec `status: 'failed'`, jamais une exception. L'appelant lit `status`.
 */
export async function importStatementFile(params: {
  accountId: string;
  file: File;
  provider: string;
  options: StatementMapping;
}): Promise<StatementImport> {
  const form = new FormData();
  form.append('account', params.accountId);
  form.append('provider', params.provider);
  form.append('file', params.file);
  form.append('options', JSON.stringify(params.options));
  const { data } = await postMultipart<StatementImport>('/banking/imports/', form);
  return data;
}

// --- Journal bancaire (parcours 25, lot 3) ----------------------------------

export type TransactionDirection = 'out' | 'in';

/**
 * Ce qu'est une recette (parcours 26, lot 5). `''` = non classée, ce qui est un
 * écart — distinct de `'other'`, qui est un choix de l'utilisateur.
 */
export type InflowNature = 'salary' | 'refund' | 'transfer' | 'other' | '';

/** Une ligne de relevé. Immuable sur le fond : seuls `is_internal` et `notes` s'écrivent. */
export interface BankTransaction {
  id: string;
  account: string;
  booked_on: string;
  value_on: string | null;
  label_raw: string;
  /** Signé : négatif = sortie. Jamais additionné aux montants d'Interaction. */
  amount: string;
  currency: string;
  direction: TransactionDirection;
  is_internal: boolean;
  inflow_nature: InflowNature;
  balance_after: string | null;
  external_id: string;
  notes: string;
  source_import: string | null;
  /** Autre jambe d'un mouvement interne (retrait ↔ crédit espèces), si liée. */
  transfer_counterpart: string | null;
  /** Somme des dépenses ventilées sur la ligne — positive. */
  allocated_amount: string;
  /** Ce qui reste à expliquer, jamais négatif. */
  remaining_amount: string;
  allocation_state: AllocationProgress;
  created_at: string;
}

/**
 * Où en est une ligne — calculé par le serveur, jamais dérivé ici.
 *
 * Le verdict dépend de la fenêtre de conformité du compte, et il doit dire
 * **exactement** ce que compte l'onglet Contrôle : le refaire côté client
 * garantirait qu'un jour les deux divergent. `''` = rien à ventiler (recette,
 * mouvement interne) ; `out_of_scope` = hors fenêtre, House n'exige rien —
 * ce n'est pas la même chose que « pas encore traitée ».
 */
export type AllocationProgress = '' | 'unallocated' | 'partial' | 'allocated' | 'out_of_scope';

export interface TransactionFilters {
  account?: string;
  date_from?: string;
  date_to?: string;
  direction?: TransactionDirection | '';
  is_internal?: 'true' | 'false' | '';
  /** `'todo'` = seulement les sorties que le contrôle réclame (non ventilées ou partielles). */
  allocation?: 'todo' | '';
  q?: string;
}

export interface TransactionPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: BankTransaction[];
}

/** Vue « banque » : ce qui est sorti du compte. À ne jamais additionner aux dépenses. */
export interface AccountFlow {
  date_from: string | null;
  date_to: string | null;
  outflow: string;
  inflow: string;
  net: string;
  transaction_count: number;
  internal_count: number;
  /** Part des sorties qu'aucune dépense n'explique (parcours 26, lot 5). */
  unallocated_outflow: string;
  /** Entre 0 et 1. Le **seul** pont admis vers les totaux de dépenses — jamais une somme. */
  coverage_ratio: number;
}

function cleanParams(filters: TransactionFilters): Record<string, string> {
  return Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''),
  ) as Record<string, string>;
}

export async function fetchTransactions(
  filters: TransactionFilters = {},
  limit = 50,
): Promise<TransactionPage> {
  const { data } = await api.get<TransactionPage>('/banking/transactions/', {
    params: { ...cleanParams(filters), limit },
  });
  return data;
}

export async function fetchAccountFlow(filters: TransactionFilters = {}): Promise<AccountFlow> {
  const { data } = await api.get<AccountFlow>('/banking/transactions/flow/', {
    params: cleanParams(filters),
  });
  return data;
}

/** La seule écriture admise sur une ligne de relevé. */
export async function qualifyTransaction(
  id: string,
  payload: { is_internal?: boolean; notes?: string; inflow_nature?: InflowNature },
): Promise<BankTransaction> {
  const { data } = await api.patch<BankTransaction>(
    `/banking/transactions/${id}/qualify/`,
    payload,
  );
  return data;
}

// --- Soldes & espèces (parcours 25, lot 4) ----------------------------------

/** Une rupture dans la chaîne des soldes : des opérations manquent. */
export interface ChainGap {
  after_transaction_id: string;
  gap_start: string;
  gap_end: string;
  expected: string;
  actual: string;
  missing_amount: string;
}

/**
 * Un solde, avec le degré de confiance qu'on peut lui accorder.
 *
 * `anchored` = lu sur le solde courant de la banque, sans hypothèse de
 * continuité. `derived` = solde d'ouverture + mouvements, exact seulement si
 * aucun relevé ne manque.
 */
export interface AccountBalance {
  amount: string;
  source: 'anchored' | 'derived';
  as_of: string | null;
  is_reliable: boolean;
  gaps: ChainGap[];
}

export async function fetchAccountBalance(
  accountId: string,
  asOf?: string,
): Promise<AccountBalance> {
  const { data } = await api.get<AccountBalance>(`/banking/accounts/${accountId}/balance/`, {
    params: asOf ? { as_of: asOf } : undefined,
  });
  return data;
}

/** Miroir d'un retrait sur le compte espèces. Les deux jambes deviennent internes. */
export async function withdrawToCash(
  transactionId: string,
  payload: { cash_account: string; amount?: string },
): Promise<BankTransaction> {
  const { data } = await api.post<BankTransaction>(
    `/banking/transactions/${transactionId}/withdraw-to-cash/`,
    payload,
  );
  return data;
}

export async function unlinkCashCounterpart(transactionId: string): Promise<void> {
  await api.delete(`/banking/transactions/${transactionId}/unlink-cash/`);
}

// --- Ventilation (parcours 25, lot 5) ---------------------------------------

/**
 * Une ligne de ventilation à envoyer. Le PUT est un « set » : on envoie tout.
 *
 * `budget_id` et `source_type`/`source_id` sont deux axes **indépendants** : une
 * ligne peut porter les deux, et compte dans les deux (parcours 26, lot 3).
 */
export interface AllocationLine {
  subject: string;
  amount: string;
  budget_id?: string | null;
  /** `projects.project` | `equipment.equipment` | `stock.stockitem`. */
  source_type?: string | null;
  source_id?: string | null;
  zone_ids?: string[];
  notes?: string;
}

/** Une dépense allouée, telle que renvoyée par l'API interactions. */
export interface AllocatedExpense {
  id: string;
  subject: string;
  amount: string | null;
  kind: string;
  budget: { id: string; name: string } | null;
  source_type: string | null;
  source_id: string | null;
  source_label: string | null;
  zone_ids: string[];
  bank_transaction: string | null;
  reconciled_by: string;
}

export interface AllocationState {
  transaction: BankTransaction;
  allocations: AllocatedExpense[];
  allocated: string;
  remaining: string;
}

export async function fetchAllocations(transactionId: string): Promise<AllocationState> {
  const { data } = await api.get<AllocationState>(
    `/banking/transactions/${transactionId}/allocations/`,
  );
  return data;
}

/** Remplace la ventilation entière. Atomique : « 80/40 devient 100/20 » en un appel. */
export async function setAllocations(
  transactionId: string,
  lines: AllocationLine[],
): Promise<AllocationState> {
  const { data } = await api.put<AllocationState>(
    `/banking/transactions/${transactionId}/allocations/`,
    { lines },
  );
  return data;
}

export async function unlinkAllocation(
  transactionId: string,
  interactionId: string,
): Promise<void> {
  await api.delete(`/banking/transactions/${transactionId}/unlink/${interactionId}/`);
}

// --- Rapprochement automatique (parcours 25, lot 6) -------------------------

/** Un appariement possible, avec les preuves derrière son score. */
export interface MatchCandidate {
  interaction_id: string;
  transaction_id: string;
  score: number;
  amount_delta: string;
  day_gap: number;
  label_ratio: number;
  interaction?: AllocatedExpense;
}

/** Un appariement possible entre une récurrence et une ligne (parcours 26, lot 6). */
export interface RecurringMatch {
  recurring_id: string;
  transaction_id: string;
  score: number;
  amount_delta: string;
  day_gap: number;
  label_ratio: number;
}

export interface ReconcileOutcome {
  auto_matched: number;
  suggestions: MatchCandidate[];
  /** Échéances que le relevé a confirmées de lui-même. */
  recurring_confirmed: number;
  recurring_suggestions: RecurringMatch[];
}

/** Relance le matcher. Idempotent : ce qui est déjà rapproché est hors du pool. */
export async function reconcileTransactions(params: {
  date_from?: string;
  date_to?: string;
} = {}): Promise<ReconcileOutcome> {
  const { data } = await api.post<ReconcileOutcome>('/banking/transactions/reconcile/', params);
  return data;
}

export async function fetchSuggestions(transactionId: string): Promise<MatchCandidate[]> {
  const { data } = await api.get<MatchCandidate[]>(
    `/banking/transactions/${transactionId}/suggestions/`,
  );
  return data;
}

/** Accepte une suggestion : rattache la dépense proposée à la ligne. */
export async function linkInteraction(
  transactionId: string,
  interactionId: string,
): Promise<AllocatedExpense> {
  const { data } = await api.post<AllocatedExpense>(
    `/banking/transactions/${transactionId}/link/`,
    { interaction: interactionId },
  );
  return data;
}

// --- Conformité (parcours 26, lot 1) ----------------------------------------

export type ComplianceSeverity = 'blocker' | 'error' | 'warning';

/**
 * Un écart, sur un objet. `fingerprint` est le hash de ce qui **fonde** l'écart :
 * c'est lui qui fait périmer un arbitrage quand la situation bouge.
 */
export interface ComplianceFinding {
  kind: string;
  object_id: string;
  label: string;
  fingerprint: string;
  detail: Record<string, string | number | boolean | null | unknown>;
  /** Arbitrage périmé : l'écart est revenu sur la pile, motif d'origine affiché. */
  is_stale: boolean;
  waiver_id: string | null;
  waiver_reason: string;
}

/** Les compteurs d'un détecteur. Invariant : `open + waived === detected`. */
export interface ComplianceGroup {
  kind: string;
  severity: ComplianceSeverity;
  label: string;
  target: string;
  /** Faux quand le catalogue dit « aucun flag légitime » — l'écart se corrige. */
  waivable: boolean;
  /** Clé d'un prérequis : explique pourquoi ce contrôle ne porte pas sur tout. */
  blocked_by: string;
  detected: number;
  open: number;
  waived: number;
  stale: number;
}

export interface ComplianceSummary {
  groups: ComplianceGroup[];
  open_total: number;
  waived_total: number;
  stale_total: number;
}

export interface ComplianceGroupPage extends ComplianceGroup {
  results: ComplianceFinding[];
  limit: number;
  offset: number;
}

/** Compteurs seuls — lu à chaque navigation, doit rester bon marché côté serveur. */
export async function fetchComplianceSummary(): Promise<ComplianceSummary> {
  const { data } = await api.get<ComplianceSummary>('/banking/compliance/');
  return data;
}

export async function fetchComplianceGroup(
  kind: string,
  params: { waived?: boolean; limit?: number; offset?: number } = {},
): Promise<ComplianceGroupPage> {
  const { data } = await api.get<ComplianceGroupPage>(`/banking/compliance/${kind}/`, {
    params: {
      ...(params.waived ? { waived: 'true' } : {}),
      ...(params.limit !== undefined ? { limit: params.limit } : {}),
      ...(params.offset ? { offset: params.offset } : {}),
    },
  });
  return data;
}

export interface ComplianceWaiver {
  id: string;
  finding_kind: string;
  object_id: string;
  reason: string;
  fingerprint: string;
  created_at: string;
}

/**
 * Arbitre un écart — jamais un « ignorer ». Le motif est **requis** côté serveur,
 * et un second appel sur le même écart met à jour le motif *et* le fingerprint
 * (c'est le chemin du « ré-arbitrer » sur un arbitrage périmé).
 */
export async function createWaiver(payload: {
  finding_kind: string;
  object_id: string;
  reason: string;
}): Promise<ComplianceWaiver> {
  const { data } = await api.post<ComplianceWaiver>('/banking/waivers/', payload);
  return data;
}

/** Révoque un arbitrage : l'écart resurgit à l'identique. */
export async function deleteWaiver(id: string): Promise<void> {
  await api.delete(`/banking/waivers/${id}/`);
}

// --- Dépense en espèces (parcours 26, lot 4) --------------------------------

export interface CashExpensePayload {
  account: string;
  label: string;
  /** Positif — ce que l'utilisateur a dépensé. Stocké signé côté serveur. */
  amount: string;
  booked_on?: string;
  budget_id?: string | null;
  zone_ids?: string[];
  source_type?: string | null;
  source_id?: string | null;
  notes?: string;
}

export interface CashExpenseResult {
  transaction: BankTransaction;
  allocations: AllocatedExpense[];
}

/**
 * Dépense en espèces : l'opération **et** sa ventilation naissent ensemble.
 *
 * Passer par le compte plutôt que créer une dépense nue supprime par construction
 * l'orphelin « dépense que la banque n'a jamais vue » — un écart que le contrôle
 * ne pourrait que signaler sans que personne puisse le résoudre.
 */
export async function recordCashExpense(
  payload: CashExpensePayload,
): Promise<CashExpenseResult> {
  const { data } = await api.post<CashExpenseResult>(
    '/banking/transactions/cash-expense/',
    payload,
  );
  return data;
}
