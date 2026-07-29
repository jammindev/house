import type { Budget, BudgetCategory } from '@/lib/api/budget';

export interface BudgetOption {
  value: string;
  /** « Maison › Bricolage » — le chemin, parce que « Énergie » seul est ambigu. */
  label: string;
}

/**
 * Les budgets sur lesquels un euro peut se ranger, avec leur chemin.
 *
 * **Tous les budgets nommés en sont**, y compris ceux rangés dans une catégorie :
 * une catégorie est un intitulé, pas une case, donc y classer une enveloppe ne
 * lui retire rien. C'est la simplification que le modèle précédent ne permettait
 * pas — un budget qui recevait des « enfants » cessait, en silence, de pouvoir
 * recevoir des dépenses, et il fallait le retirer de six sélecteurs.
 *
 * Seul le budget global est écarté : il plafonne tout, il n'est la case de rien.
 *
 * Cette fonction existe en un exemplaire parce que **sept sélecteurs** filtraient
 * les budgets à la main (`.filter(b => !b.is_global)`) : sept endroits à corriger
 * à chaque règle nouvelle, donc sept occasions d'en oublier un.
 */
export function selectableBudgets(budgets: Budget[] | undefined): BudgetOption[] {
  return (budgets ?? [])
    .filter((b) => !b.is_global)
    .map((b) => ({
      value: b.id,
      label: b.category ? `${b.category.name} › ${b.name}` : b.name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Les catégories proposables au rangement d'un budget, par ordre alphabétique. */
export function categoryOptions(categories: BudgetCategory[] | undefined): BudgetOption[] {
  return (categories ?? [])
    .map((c) => ({ value: c.id, label: c.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
