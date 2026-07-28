/**
 * Clés partagées du module Argent — query keys et clés de détecteurs.
 *
 * Fichier séparé de `hooks.ts` **exprès** : `banking/hooks.ts` doit pouvoir
 * invalider la conformité après une ventilation, et `money/hooks.ts` importe déjà
 * `bankingKeys`. Passer par ce module sans dépendance sortante casse le cycle
 * qu'un import direct créerait, sans dupliquer la chaîne `'compliance'` dans deux
 * fichiers (où elle finirait par diverger d'un caractère).
 */

/**
 * Les cinq racines de cache que l'argent partage.
 *
 * Elles vivent ici et pas dans le `hooks.ts` de chaque feature parce qu'une
 * mutation bancaire doit pouvoir invalider les budgets, et réciproquement. Tant
 * qu'elles étaient écrites en littéraux au point d'appel (`['budget']`,
 * `['expenses']`…), chaque hook déclarait sa propre liste — et elles ont dérivé :
 * cinq mutations sur huit oubliaient au moins une famille. Voir
 * `useInvalidateMoney`.
 */
export const BANKING_ROOT = ['banking'] as const;
export const INTERACTIONS_ROOT = ['interactions'] as const;
export const EXPENSES_ROOT = ['expenses'] as const;
export const BUDGET_ROOT = ['budget'] as const;
export const COMPLIANCE_ROOT = ['compliance'] as const;

export const complianceKeys = {
  all: COMPLIANCE_ROOT,
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
export const ACCOUNT_ANCHOR_STALE = 'account_anchor_stale';
export const INFLOW_UNCLASSIFIED = 'inflow_unclassified';
export const REFUND_WITHOUT_BUDGET = 'refund_without_budget';
export const REFUND_PARTIALLY_ALLOCATED = 'refund_partially_allocated';

/** Ce qui est sorti et que personne n'a affecté — pastilles de budget. */
export const PENDING_OUTFLOW_KINDS = [TRANSACTION_UNALLOCATED, TRANSACTION_PARTIAL] as const;

/**
 * Ce qui est **entré** et que personne n'a qualifié — pastilles de nature.
 *
 * Même file et même geste que les sorties, décidé en recette : « d'abord les
 * recettes doivent être considérées comme des dépenses ». Une recette non classée
 * est du travail de rangement au même titre qu'une sortie non ventilée, et les
 * séparer en deux écrans obligeait à se souvenir lequel on avait vidé.
 */
export const PENDING_INFLOW_KINDS = [
  INFLOW_UNCLASSIFIED,
  REFUND_WITHOUT_BUDGET,
  REFUND_PARTIALLY_ALLOCATED,
] as const;

/** Tout ce que la file traite — ce que compte le badge de la coque. */
export const PENDING_KINDS = [...PENDING_OUTFLOW_KINDS, ...PENDING_INFLOW_KINDS] as const;
