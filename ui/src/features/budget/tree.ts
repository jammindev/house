import type { Budget } from '@/lib/api/budget';

export interface BudgetOption {
  value: string;
  /** « Maison › Bricolage » — le chemin, parce que « Énergie » seul est ambigu. */
  label: string;
}

/**
 * Les budgets sur lesquels un euro peut se ranger, avec leur chemin.
 *
 * **Un groupe est un sous-total, jamais une case** : « Maison » totalise
 * « Bricolage » et « Énergie », donc y ranger une dépense donnerait à `spent`
 * deux sens — le propre et le consolidé — que tous les compteurs devraient
 * distinguer pour toujours, y compris les bilans mensuels déjà figés. Le serveur
 * le refuse ; cette fonction fait en sorte que l'interface ne le propose même
 * pas, parce qu'offrir une option qui produit un 400 est pire que ne pas
 * l'offrir.
 *
 * Elle existe en un exemplaire parce que **sept sélecteurs** filtraient les
 * budgets à la main (`.filter(b => !b.is_global)`) : sept endroits à corriger à
 * chaque règle nouvelle, donc sept occasions d'en oublier un.
 */
export function selectableBudgets(budgets: Budget[] | undefined): BudgetOption[] {
  const rows = budgets ?? [];
  const nameById = new Map(rows.map((b) => [b.id, b.name]));

  return rows
    .filter((b) => !b.is_global && !b.is_group)
    .map((b) => ({
      value: b.id,
      label: b.parent ? `${nameById.get(b.parent.id) ?? b.parent.name} › ${b.name}` : b.name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Les budgets qui peuvent servir de groupe à `selfId`.
 *
 * Mêmes règles que le serveur, dans le même ordre : pas le budget global, pas
 * soi-même, pas un budget déjà rangé dans un groupe (deux niveaux), et pas un
 * groupe si l'on en est déjà un.
 */
export function groupCandidates(budgets: Budget[] | undefined, selfId?: string): BudgetOption[] {
  const rows = budgets ?? [];
  const self = selfId ? rows.find((b) => b.id === selfId) : undefined;
  if (self?.is_group) return [];

  return rows
    .filter((b) => !b.is_global && b.id !== selfId && !b.parent)
    .map((b) => ({ value: b.id, label: b.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
