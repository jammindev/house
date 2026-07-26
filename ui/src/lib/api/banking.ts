import { api } from '@/lib/axios';

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
  const { data } = await api.post<StatementPreview>('/banking/imports/preview/', form);
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
  const { data } = await api.post<StatementImport>('/banking/imports/', form);
  return data;
}

// --- Journal bancaire (parcours 25, lot 3) ----------------------------------

export type TransactionDirection = 'out' | 'in';

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
  balance_after: string | null;
  external_id: string;
  notes: string;
  source_import: string | null;
  /** Autre jambe d'un mouvement interne (retrait ↔ crédit espèces), si liée. */
  transfer_counterpart: string | null;
  created_at: string;
}

export interface TransactionFilters {
  account?: string;
  date_from?: string;
  date_to?: string;
  direction?: TransactionDirection | '';
  is_internal?: 'true' | 'false' | '';
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
  payload: { is_internal?: boolean; notes?: string },
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
