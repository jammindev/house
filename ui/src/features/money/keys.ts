/**
 * Clés partagées du module Argent — query keys et clés de détecteurs.
 *
 * Fichier séparé de `hooks.ts` **exprès** : `banking/hooks.ts` doit pouvoir
 * invalider la conformité après une ventilation, et `money/hooks.ts` importe déjà
 * `bankingKeys`. Passer par ce module sans dépendance sortante casse le cycle
 * qu'un import direct créerait, sans dupliquer la chaîne `'compliance'` dans deux
 * fichiers (où elle finirait par diverger d'un caractère).
 */

export const complianceKeys = {
  all: ['compliance'] as const,
  summary: () => [...complianceKeys.all, 'summary'] as const,
  group: (kind: string, waived: boolean, offset: number) =>
    [...complianceKeys.all, 'group', kind, waived, offset] as const,
};

/**
 * Clés des détecteurs, telles que déclarées par `banking/detectors.py`.
 * Miroir côté front — une faute de frappe ici ne produit pas d'erreur serveur,
 * juste un groupe vide, d'où les constantes plutôt que des littéraux dispersés.
 */
export const TRANSACTION_UNALLOCATED = 'transaction_unallocated';
export const TRANSACTION_PARTIAL = 'transaction_partially_allocated';
export const EXPENSE_UNRECONCILED = 'expense_unreconciled';
export const ACCOUNT_WITHOUT_WINDOW = 'account_without_window';
export const ACCOUNT_CHAIN_BROKEN = 'account_chain_broken';

/** Les deux écarts que la file « À ranger » traite — même geste de résolution. */
export const PENDING_KINDS = [TRANSACTION_UNALLOCATED, TRANSACTION_PARTIAL] as const;
