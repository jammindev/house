/** Les cinq onglets qu'a portés `/app/money` avant l'éclatement (issue #562). */
export type LegacyMoneyTab = 'control' | 'pending' | 'accounts' | 'expenses' | 'budgets';

/** La page qui accueille désormais chaque ancien onglet. */
const PAGE_FOR_TAB: Record<LegacyMoneyTab, string> = {
  budgets: '/app/money/budgets',
  expenses: '/app/money/expenses',
  accounts: '/app/money/accounts',
  control: '/app/money/accounts',
  pending: '/app/money/accounts',
};

/**
 * `?tab=` ne survit que là où il désigne encore quelque chose : la page Comptes
 * a gardé trois onglets, les deux autres n'en ont plus. Un paramètre qui ne
 * pilote rien reste dans l'URL, se recopie dans un favori, et finit par faire
 * croire à une intention que la page n'honore pas.
 */
const TABBED_PAGE = '/app/money/accounts';

/** Sans `?tab=` ni défaut : la première page du groupe. */
const DEFAULT_TAB: LegacyMoneyTab = 'budgets';

function isLegacyTab(value: string | null): value is LegacyMoneyTab {
  return value !== null && value in PAGE_FOR_TAB;
}

/**
 * Résout l'URL de destination d'un ancien lien de la famille argent.
 *
 * `fallback` est l'onglet que l'ancienne page désignait d'elle-même
 * (`/app/budget` → budgets) ; un `?tab=` explicite dans l'URL gagne, c'est
 * l'intention de l'appelant. Le reste de la query string est **préservé** : un
 * lien qui portait `?b={id}` ouvrait *un* budget, et le perdre le transforme en
 * lien approximatif — pire qu'un lien mort, puisqu'il continue de marcher.
 */
export function resolveMoneyRedirect(
  search: string,
  fallback: LegacyMoneyTab = DEFAULT_TAB,
  hash = '',
): string {
  const params = new URLSearchParams(search);
  const requested = params.get('tab');
  const tab = isLegacyTab(requested) ? requested : fallback;
  const page = PAGE_FOR_TAB[tab];

  if (page === TABBED_PAGE) {
    params.set('tab', tab);
  } else {
    params.delete('tab');
  }

  const query = params.toString();
  return `${page}${query ? `?${query}` : ''}${hash}`;
}
