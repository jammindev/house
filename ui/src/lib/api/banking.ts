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
