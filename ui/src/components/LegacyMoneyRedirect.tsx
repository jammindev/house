import { Navigate, useLocation } from 'react-router-dom';

interface LegacyMoneyRedirectProps {
  /** Onglet du module Argent qui remplace l'ancienne page. */
  tab: 'accounts' | 'expenses' | 'budgets';
}

/**
 * Redirige `/app/banking`, `/app/expenses` et `/app/budget` vers l'onglet
 * correspondant du module Argent (parcours 26, lot 2).
 *
 * Deux points qui justifient un composant plutôt qu'un `<Navigate to>` en dur :
 *
 * - **la query string est préservée**. L'agent produit `/app/budget?b={id}`
 *   (`apps/budget/apps.py::SearchableSpec.url_template`), et un favori peut porter
 *   n'importe quel paramètre. Les perdre transformerait un lien précis en lien
 *   approximatif ;
 * - **`?tab=` est ajouté**, pour atterrir sur le bon onglet plutôt que sur celui
 *   que l'utilisateur regardait la dernière fois.
 *
 * Un `tab` déjà présent dans l'URL gagne : c'est l'intention explicite de
 * l'appelant.
 */
export default function LegacyMoneyRedirect({ tab }: LegacyMoneyRedirectProps) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  if (!params.get('tab')) params.set('tab', tab);

  return <Navigate to={`/app/money?${params.toString()}`} replace />;
}
